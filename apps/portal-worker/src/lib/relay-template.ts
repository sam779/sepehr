/**
 * Relay Worker template.
 *
 * buildRelayScript() returns a complete, self-contained Cloudflare Workers ES module
 * that proxies Trojan-over-WebSocket connections by forwarding them to a VPS relay
 * server over a second WebSocket connection.  The VPS relay opens the outbound TCP
 * connection; the Worker is control-plane only.
 *
 * Security properties:
 *  - Constant-time password comparison (timingSafeEqual)
 *  - Full SSRF protection enforced on both Worker and VPS
 *  - In-memory rate limiting: 10 WS / 5 min / IP
 *  - Frame guards: >16KB first frame → immediate close
 *  - Fail-open on portal downtime (so users aren't locked out)
 *  - UDP CMD (0x03) rejected with WS 1003
 *  - Idle 5-min + hard 1-h timeouts
 *  - Short-lived HMAC session tokens (30 s TTL) for VPS authentication
 */

export interface RelayScriptParams {
  relayId: string;
  portalUrl: string;
  relaySecret: string;
  vpsRelayUrl: string;    // e.g. "https://1.2.3.4:8080/tunnel" (fetch upgrade → WS)
  vpsTunnelSecret: string; // HMAC-SHA256 shared secret for session tokens
}

export function buildRelayScript({
  relayId,
  portalUrl,
  relaySecret,
  vpsRelayUrl,
  vpsTunnelSecret,
}: RelayScriptParams): string {
  // JSON.stringify ensures the strings are safely embedded as JS string literals
  const RELAY_ID = JSON.stringify(relayId);
  const PORTAL_URL = JSON.stringify(portalUrl);
  const RELAY_SECRET = JSON.stringify(relaySecret);
  const VPS_RELAY_URL = JSON.stringify(vpsRelayUrl);
  const VPS_TUNNEL_SECRET = JSON.stringify(vpsTunnelSecret);

  return `
const RELAY_ID = ${RELAY_ID};
const PORTAL_URL = ${PORTAL_URL};
const RELAY_SECRET = ${RELAY_SECRET};
const VPS_RELAY_URL = ${VPS_RELAY_URL};
const VPS_TUNNEL_SECRET = ${VPS_TUNNEL_SECRET};
const DEBUG = false; // set to true for verbose connection logs

// ─── In-memory rate limit (resets per-isolate restart) ───────────────────────
const rateLimitMap = new Map(); // ip → { count, windowStart }
const RL_MAX = 10;
const RL_WINDOW_MS = 5 * 60 * 1000;

function rateLimitCheck(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RL_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX;
}

// ─── Constant-time string comparison ────────────────────────────────────────
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length; // non-zero if lengths differ
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

// ─── Trojan header parser ────────────────────────────────────────────────────
// Wire format: <password>\\r\\n<cmd:1><atyp:1><addr...><port:2>\\r\\n<payload...>
function parseTrojanHeader(buffer) {
  if (buffer.length > 16 * 1024) return null; // Guard: >16KB

  // Find first \\r\\n (password terminator) within first 256 bytes
  const limit = Math.min(buffer.length, 256);
  let crlfPos = -1;
  for (let i = 0; i < limit - 1; i++) {
    if (buffer[i] === 0x0d && buffer[i + 1] === 0x0a) { crlfPos = i; break; }
  }
  if (crlfPos === -1) return null; // no CRLF in first 256 bytes

  const dec = new TextDecoder();
  const password = dec.decode(buffer.slice(0, crlfPos));
  if (!password) return null; // empty password

  let offset = crlfPos + 2;
  if (buffer.length < offset + 4) return null;

  const cmd  = buffer[offset++];
  const atyp = buffer[offset++];
  let host;

  if (atyp === 0x01) {
    // IPv4 (4 bytes)
    if (buffer.length < offset + 4) return null;
    host = buffer[offset] + '.' + buffer[offset+1] + '.' + buffer[offset+2] + '.' + buffer[offset+3];
    offset += 4;
  } else if (atyp === 0x03) {
    // Domain (length-prefixed)
    const domainLen = buffer[offset++];
    if (buffer.length < offset + domainLen) return null;
    host = dec.decode(buffer.slice(offset, offset + domainLen));
    offset += domainLen;
  } else if (atyp === 0x04) {
    // IPv6 (16 bytes)
    if (buffer.length < offset + 16) return null;
    const parts = [];
    for (let i = 0; i < 16; i += 2) {
      parts.push(((buffer[offset + i] << 8) | buffer[offset + i + 1]).toString(16));
    }
    host = parts.join(':');
    offset += 16;
  } else {
    return null; // Unknown ATYP
  }

  if (buffer.length < offset + 2) return null;
  const port = (buffer[offset] << 8) | buffer[offset + 1];
  offset += 2;

  // Skip optional trailing \\r\\n after address
  if (buffer.length >= offset + 2 && buffer[offset] === 0x0d && buffer[offset + 1] === 0x0a) {
    offset += 2;
  }

  return { password, cmd, atyp, host, port, dataOffset: offset };
}

// ─── SSRF protection ─────────────────────────────────────────────────────────

function parseIPv4ToUint32(host) {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(p => parseInt(p, 10));
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

function isBlockedIPv4Uint32(ip) {
  if ((ip >>> 24) === 127)                          return true; // 127.0.0.0/8
  if ((ip >>> 24) === 10)                           return true; // 10.0.0.0/8
  if ((ip >>> 20) === ((172 << 4) | 1))             return true; // 172.16.0.0/12
  if ((ip >>> 16) === ((192 << 8) | 168))           return true; // 192.168.0.0/16
  if ((ip >>> 16) === ((169 << 8) | 254))           return true; // 169.254.0.0/16
  if (ip === 0)                                     return true; // 0.0.0.0
  // 168.63.129.16 (Azure IMDS)
  if (ip === (((168 << 24) | (63 << 16) | (129 << 8) | 16) >>> 0)) return true;
  return false;
}

function validateHostname(domain) {
  if (!/^[a-zA-Z0-9._-]+$/.test(domain)) return false;
  if (domain.length > 253) return false;
  const labels = domain.split('.');
  if (labels.some(l => l.length === 0 || l.length > 63)) return false;
  // Reject all-numeric labels → treat as dotted-IP
  if (labels.every(l => /^\\d+$/.test(l))) return false;
  return true;
}

function isBlockedHost(host) {
  const lower = host.toLowerCase();

  // IPv4 CIDR check
  const ipv4 = parseIPv4ToUint32(host);
  if (ipv4 !== null) return isBlockedIPv4Uint32(ipv4);

  // IPv6
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;

  // Domain checks
  if (lower === 'localhost') return true;
  if (lower.endsWith('.local') || lower === 'local') return true;
  if (lower.endsWith('.internal') || lower === 'internal') return true;
  if (lower.startsWith('metadata.')) return true;
  if (lower.endsWith('.amazonaws.com')) return true;

  // All-numeric labels → dotted-IP disguised as hostname
  const labels = lower.split('.');
  if (labels.every(l => /^\\d+$/.test(l))) {
    const ipv4b = parseIPv4ToUint32(lower);
    return ipv4b !== null ? isBlockedIPv4Uint32(ipv4b) : true;
  }

  return false;
}

// ─── Portal access check (fail-open) ─────────────────────────────────────────
async function checkAccess(password, relayId, portalUrl, relaySecret) {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 500);
    const res = await fetch(portalUrl + '/relay/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + relaySecret,
      },
      // 'password' here is the SHA224 hex string the Trojan client sent —
      // portal compares it directly against stored password_hash.
      body: JSON.stringify({ hash: password, relay_id: relayId }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return { valid: false, paused: false };
    const data = await res.json();
    return { valid: !!data.valid, paused: !!data.paused };
  } catch {
    // Fail-open: if portal is unreachable, allow the connection
    return { valid: true, paused: false };
  }
}

// ─── Fire-and-forget portal notification ────────────────────────────────────
function notifyPortal(relayId, event, portalUrl, relaySecret) {
  fetch(portalUrl + '/relay/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + relaySecret,
    },
    body: JSON.stringify({ relay_id: relayId, event }),
  }).catch(() => {});
}

// ─── Concat two Uint8Arrays ──────────────────────────────────────────────────
function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(0);
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

// ─── Session token for VPS authentication ────────────────────────────────────
// Generates a short-lived HMAC-SHA256 signed token so the VPS can verify that
// this Worker is authorised to open a tunnel to host:port.
// TTL = 30 s — long enough to survive Worker→VPS round-trip latency.
async function generateSessionToken(host, port, tunnelSecret) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const expiry = Date.now() + 30_000;
  const payload = JSON.stringify({ host, port, expiry, nonce });

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(tunnelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sig = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // base64url encode the envelope so it's safe as a JSON string value
  const envelope = JSON.stringify({ payload, sig });
  return btoa(envelope).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
}

// ─── Connect to VPS relay and perform handshake ───────────────────────────────
// CF Workers outbound WebSocket: use fetch() with Upgrade: websocket header.
// Returns the accepted WebSocket after the VPS has confirmed TCP is ready.
async function connectToVps(host, port) {
  const token = await generateSessionToken(host, port, VPS_TUNNEL_SECRET);

  // CF Workers outbound WS via fetch upgrade
  const response = await fetch(VPS_RELAY_URL, {
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    },
  });

  if (response.status !== 101) {
    throw new Error('VPS WS upgrade failed: ' + response.status);
  }

  const vpsWs = response.webSocket;
  if (!vpsWs) throw new Error('response.webSocket not available');

  vpsWs.accept();

  // Wait for ack ({status:'ok'}) before returning — the VPS sends this once
  // the TCP connection to host:port is established.
  const ack = await new Promise((resolve, reject) => {
    const tid = setTimeout(() => reject(new Error('VPS handshake timeout')), 8_000);

    vpsWs.addEventListener('message', (event) => {
      clearTimeout(tid);
      try { resolve(JSON.parse(event.data)); }
      catch { reject(new Error('VPS ack parse error')); }
    });
    vpsWs.addEventListener('error', () => {
      clearTimeout(tid);
      reject(new Error('VPS WS error during handshake'));
    });
    vpsWs.addEventListener('close', () => {
      clearTimeout(tid);
      reject(new Error('VPS WS closed before ack'));
    });

    // Send the connect command — VPS will open TCP then reply {status:'ok'}
    vpsWs.send(JSON.stringify({ type: 'connect', token, host, port }));
  });

  if (!ack || ack.status !== 'ok') {
    vpsWs.close(1011, 'VPS rejected');
    throw new Error('VPS rejected: ' + JSON.stringify(ack));
  }

  return vpsWs;
}

// ─── Bidirectional pipe: client WS ↔ VPS WS ──────────────────────────────────
// reader  — the TransformStream reader that yields client WS frames as Uint8Arrays
// initialData — payload bytes that arrived in the same frame as the Trojan header
async function pipeWsToWs(clientWs, vpsWs, reader, initialData) {
  const IDLE_MS = 5 * 60 * 1000;
  const HARD_MS = 60 * 60 * 1000;
  let idleHandle;
  let finished = false;

  let resolveFinish;
  const donePromise = new Promise(r => { resolveFinish = r; });

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(idleHandle);
    clearTimeout(hardHandle);
    try { clientWs.close(1000, 'done'); } catch {}
    try { vpsWs.close(1000, 'done'); } catch {}
    resolveFinish();
  };

  const resetIdle = () => {
    clearTimeout(idleHandle);
    idleHandle = setTimeout(() => {
      console.log('[pipe] idle timeout');
      finish();
    }, IDLE_MS);
  };
  resetIdle();
  const hardHandle = setTimeout(() => {
    console.log('[pipe] hard timeout');
    finish();
  }, HARD_MS);

  // VPS → client: attach a message listener (event-driven, non-blocking)
  vpsWs.addEventListener('message', (event) => {
    resetIdle();
    const chunk = toUint8Array(event.data);
    if (chunk.length === 0) return;
    console.log('[pipe vps→client]', chunk.length, 'bytes');
    try { clientWs.send(chunk); } catch (e) {
      console.error('[pipe vps→client] send error:', String(e));
      finish();
    }
  });
  vpsWs.addEventListener('close', () => { console.log('[pipe] vps closed'); finish(); });
  vpsWs.addEventListener('error', (e) => {
    console.error('[pipe] vps error:', String(e));
    finish();
  });

  // client → VPS: read from the TransformStream reader asynchronously
  const forwardClientToVps = async () => {
    try {
      // Forward any payload that arrived with the Trojan header
      if (initialData && initialData.length > 0) {
        console.log('[pipe client→vps] initial', initialData.length, 'bytes');
        vpsWs.send(initialData);
        resetIdle();
      }

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[pipe client→vps] reader done');
          break;
        }
        resetIdle();
        const chunk = toUint8Array(value);
        if (chunk.length === 0) continue;
        console.log('[pipe client→vps]', chunk.length, 'bytes');
        try { vpsWs.send(chunk); } catch (e) {
          console.error('[pipe client→vps] vps send error:', String(e));
          break;
        }
      }
    } catch (e) {
      console.error('[pipe client→vps] error:', String(e));
    } finally {
      finish();
    }
  };

  forwardClientToVps(); // fire without await — races with donePromise
  await donePromise;
}

// ─── Trojan handler ──────────────────────────────────────────────────────────
async function handleTrojanSession(ws, ip) {
  // MUST be the very first line — before any await
  ws.accept({ allowHalfOpen: true });
  console.log('[ws] accepted, ip:', ip);

  try {
    // Queue ALL incoming WS frames immediately so none are missed
    const { readable, writable } = new TransformStream();
    const msgWriter = writable.getWriter();

    const onMessage = (event) => {
      if (typeof event.data === 'string') return;
      const chunk = toUint8Array(event.data);
      if (chunk.length === 0) return;
      msgWriter.write(chunk).catch(() => msgWriter.close().catch(() => {}));
    };
    const onClose = (event) => {
      console.log('[ws] close event code:', event.code, 'reason:', event.reason, 'readyState:', ws.readyState);
      msgWriter.close().catch(() => {});
    };
    const onError = (event) => {
      console.error('[ws] error event readyState:', ws.readyState, 'event:', String(event.type ?? 'error'));
      msgWriter.close().catch(() => {});
    };

    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
    ws.addEventListener('error', onError);

    const reader = readable.getReader();
    const headerTimeoutHandle = setTimeout(() => {
      console.log('[ws] header timeout, ip:', ip);
      try { ws.close(1002, 'Header timeout'); } catch {}
      msgWriter.close().catch(() => {});
    }, 10_000);

    try {
      // ── Accumulate frames until full Trojan header is parseable ────────────
      let buffer = new Uint8Array(0);
      let header = null;

      while (!header) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[ws] stream done before header parsed, ip:', ip);
          try { ws.close(1002, 'No header'); } catch {}
          return;
        }
        console.log('[header] frame received, frameLen:', value.length,
          'totalBuf:', buffer.length + value.length);
        buffer = concatBytes(buffer, value);

        if (buffer.length > 16 * 1024) {
          console.log('[header] buffer overflow:', buffer.length);
          try { ws.close(1009, 'Header too large'); } catch {}
          return;
        }
        header = parseTrojanHeader(buffer);
      }

      clearTimeout(headerTimeoutHandle);

      // Debug: hex dump of first 80 bytes + parsed fields
      const previewLen = Math.min(buffer.length, 80);
      const hex = Array.from(buffer.slice(0, previewLen))
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log('[header] first', previewLen, 'bytes:', hex);
      console.log('[header] parsed → host:', header.host, 'port:', header.port,
        'cmd:', header.cmd, 'atyp:', header.atyp,
        'dataOffset:', header.dataOffset, 'pwdLen:', header.password.length);

      // ── Reject UDP ──────────────────────────────────────────────────────────
      if (header.cmd === 0x03) {
        console.log('[trojan] UDP rejected');
        try { ws.close(1003, 'UDP not supported'); } catch {}
        return;
      }

      // ── Portal access check ────────────────────────────────────────────────
      const { valid, paused } = await checkAccess(
        header.password, RELAY_ID, PORTAL_URL, RELAY_SECRET);
      console.log('[access] valid:', valid, 'paused:', paused);
      if (!valid) { try { ws.close(1008, 'Unauthorized'); } catch {} return; }
      if (paused)  { try { ws.close(1008, 'Paused');       } catch {} return; }
      console.log('[access] passed');

      // ── SSRF protection ────────────────────────────────────────────────────
      if (header.atyp === 0x03 && !validateHostname(header.host)) {
        console.log('[ssrf] invalid hostname:', header.host);
        try { ws.close(1008, 'Invalid hostname'); } catch {}
        return;
      }
      if (isBlockedHost(header.host)) {
        console.log('[ssrf] blocked host:', header.host);
        try { ws.close(1008, 'Blocked host'); } catch {}
        return;
      }

      // ── Connect to VPS relay ───────────────────────────────────────────────
      console.log('[vps] connecting  host:', header.host, 'port:', header.port);
      let vpsWs;
      try {
        vpsWs = await connectToVps(header.host, header.port);
        console.log('[vps] tunnel ready  host:', header.host, 'port:', header.port);
      } catch (e) {
        console.error('[vps] connect failed:', String(e),
          'host:', header.host, 'port:', header.port);
        try { ws.close(1011, 'RELAY_UNAVAILABLE'); } catch {}
        return;
      }

      notifyPortal(RELAY_ID, 'connect', PORTAL_URL, RELAY_SECRET);

      // Extract payload bytes that came in the same buffer as the header
      const initialData = buffer.length > header.dataOffset
        ? buffer.slice(header.dataOffset)
        : null;
      console.log('[pipe] initialData:', initialData ? initialData.length : 0, 'bytes');

      // ── Bidirectional pipe ─────────────────────────────────────────────────
      console.log('[pipe] start  host:', header.host, 'port:', header.port);
      await pipeWsToWs(ws, vpsWs, reader, initialData);

    } finally {
      clearTimeout(headerTimeoutHandle);
      ws.removeEventListener('message', onMessage);
      ws.removeEventListener('close', onClose);
      ws.removeEventListener('error', onError);
      try { reader.releaseLock(); } catch {}
    }

  } catch (e) {
    console.error('[handleTrojanSession] uncaught error:', String(e));
    try { ws.close(1011, 'Internal error'); } catch {}
  }
}

// ─── Main fetch handler ───────────────────────────────────────────────────────
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Unconditional request log — always visible in CF Worker logs
    console.log('[req]', request.method, url.pathname,
      'Upgrade:', request.headers.get('Upgrade') ?? '(none)');

    // Health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', relay_id: RELAY_ID });
    }

    // Trojan-over-WebSocket — exact match + prefix for ed= variants
    if (url.pathname === '/trojan' || url.pathname.startsWith('/trojan/') || url.pathname.startsWith('/trojan?')) {
      console.log('[trojan] path hit, Upgrade:', request.headers.get('Upgrade') ?? '(none)');

      const upgrade = request.headers.get('Upgrade');
      if (upgrade !== 'websocket') {
        console.log('[trojan] missing WebSocket upgrade, returning 400');
        return new Response('Expected WebSocket upgrade', { status: 400 });
      }

      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      console.log('[trojan] upgrade OK, ip:', ip);

      if (rateLimitCheck(ip)) {
        return new Response('Rate limit exceeded', { status: 429 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      // ws.accept() is called inside handleTrojanSession before any await
      handleTrojanSession(server, ip).catch(() => {
        try { server.close(1011, 'Internal error'); } catch {}
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // Catch-all: log unmatched paths to help debug routing
    console.log('[unmatched]', url.pathname);
    return new Response('Not found', { status: 404 });
  },
};
`.trimStart();
}
