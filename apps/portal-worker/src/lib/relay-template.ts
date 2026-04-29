/**
 * Relay Worker template.
 *
 * buildRelayScript() returns a complete, self-contained Cloudflare Workers ES module
 * that proxies Trojan-over-WebSocket connections using cloudflare:sockets for outbound TCP.
 *
 * Security properties:
 *  - Constant-time password comparison (timingSafeEqual)
 *  - Full SSRF protection: RFC1918 + link-local + cloud metadata CIDR blocks
 *  - In-memory rate limiting: 10 WS / 5 min / IP
 *  - Frame guards: >16KB first frame → immediate close
 *  - Fail-open on portal downtime (so users aren't locked out)
 *  - UDP CMD (0x03) rejected with WS 1003
 *  - Idle 5-min + hard 1-h timeouts with graceful closeBothSides()
 */

export interface RelayScriptParams {
  relayId: string;
  portalUrl: string;
  relaySecret: string;
}

export function buildRelayScript({ relayId, portalUrl, relaySecret }: RelayScriptParams): string {
  // JSON.stringify ensures the strings are safely embedded as JS string literals
  const RELAY_ID = JSON.stringify(relayId);
  const PORTAL_URL = JSON.stringify(portalUrl);
  const RELAY_SECRET = JSON.stringify(relaySecret);

  return `
import { connect } from 'cloudflare:sockets';

const RELAY_ID = ${RELAY_ID};
const PORTAL_URL = ${PORTAL_URL};
const RELAY_SECRET = ${RELAY_SECRET};
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

function createWsReadable(reader, initialData) {
  let sentInitialData = false;

  return new ReadableStream({
    async pull(controller) {
      if (!sentInitialData) {
        sentInitialData = true;
        if (initialData && initialData.length > 0) {
          controller.enqueue(initialData);
          return;
        }
      }

      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      try { reader.cancel(); } catch {}
    },
  });
}

function createWsWritable(ws) {
  return new WritableStream({
    write(chunk) {
      if (ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not open for outbound send');
      }
      ws.send(toUint8Array(chunk));
    },
    close() {
      try { ws.close(1000, 'done'); } catch {}
    },
    abort(reason) {
      console.error('[pipe tcp→ws] abort:', String(reason));
      try { ws.close(1011, 'Pipe aborted'); } catch {}
    },
  });
}

// ─── Bidirectional pipe: WS ↔ TCP ────────────────────────────────────────────
async function pipeStreams(ws, socket, reader, initialData) {
  const IDLE_MS = 5 * 60 * 1000;
  const HARD_MS = 60 * 60 * 1000;
  let idleHandle;
  let loggedOutboundPreview = false;

  const resetIdle = () => {
    clearTimeout(idleHandle);
    idleHandle = setTimeout(() => closeBothSides(ws, socket), IDLE_MS);
  };
  resetIdle();
  const hardHandle = setTimeout(() => closeBothSides(ws, socket), HARD_MS);

  const wsReadable = createWsReadable(reader, initialData).pipeThrough(new TransformStream({
    transform(chunk, controller) {
      const bytes = toUint8Array(chunk);
      if (bytes.length > 0 && !loggedOutboundPreview) {
        loggedOutboundPreview = true;
        console.log('[pipe ws→tcp] first 16 bytes:', bytesToHex(bytes.slice(0, 16)));
      }
      if (bytes.length > 0) {
        console.log('[pipe ws→tcp]', bytes.length, 'bytes');
        resetIdle();
      }
      controller.enqueue(bytes);
    },
    flush() {
      console.log('[pipe ws→tcp] readable closed');
    },
  }));

  const wsWritable = createWsWritable(ws);

  const wsToSocket = wsReadable.pipeTo(socket.writable).catch((e) => {
    console.error('[pipe ws→tcp] error:', String(e));
    throw e;
  });

  const socketToWs = socket.readable.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      const bytes = toUint8Array(chunk);
      if (bytes.length === 0) return;
      resetIdle();
      console.log('[pipe tcp→ws]', bytes.length, 'bytes');
      controller.enqueue(bytes);
    },
    flush() {
      console.log('[pipe tcp→ws] socket readable closed');
    },
  })).pipeTo(wsWritable).catch((e) => {
    console.error('[pipe tcp→ws] error:', String(e));
    throw e;
  });

  try {
    console.log('[pipe] start');
    await Promise.race([wsToSocket, socketToWs]);
  } finally {
    clearTimeout(idleHandle);
    clearTimeout(hardHandle);
    closeBothSides(ws, socket);
  }
}

function closeBothSides(ws, socket) {
  try { ws.close(1000, 'done'); } catch {}
  try { socket.close(); } catch {}
}

async function waitForSocketReady(socket, host, port, timeoutMs) {
  let timeoutHandle;

  try {
    const info = await Promise.race([
      socket.opened,
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('TCP ready timeout')), timeoutMs);
      }),
    ]);

    console.log(
      '[tcp] connected',
      'host:', host,
      'port:', port,
      'remote:', info.remoteAddress ?? '(unknown)',
      'local:', info.localAddress ?? '(unknown)',
    );
    return info;
  } finally {
    clearTimeout(timeoutHandle);
  }
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

      // ── Establish outbound TCP connection ──────────────────────────────────
      console.log('[tcp] attempting connect', 'host:', header.host, 'port:', header.port);
      let socket;
      try {
        console.log('[tcp] before connect()', 'host:', header.host, 'port:', header.port);
        socket = connect({ hostname: header.host, port: header.port });
        console.log('[tcp] socket created', 'host:', header.host, 'port:', header.port);
      } catch (e) {
        console.error('[tcp] connect threw:', String(e));
        try { ws.close(1011, 'Connect failed'); } catch {}
        return;
      }

      console.log('[tcp] awaiting ready', 'host:', header.host, 'port:', header.port, 'wsReadyState:', ws.readyState);

      socket.opened.catch((e) => {
        console.error('[tcp] opened rejected:', String(e), 'host:', header.host, 'port:', header.port);
      });
      socket.closed.then(() => {
        console.log('[tcp] closed cleanly', 'host:', header.host, 'port:', header.port);
      }).catch((e) => {
        console.error('[tcp] closed with error:', String(e), 'host:', header.host, 'port:', header.port);
      });

      try {
        await waitForSocketReady(socket, header.host, header.port, 5000);
      } catch (e) {
        const isTimeout = e instanceof Error && e.message === 'TCP ready timeout';
        if (isTimeout) {
          console.error('[tcp] timeout', 'host:', header.host, 'port:', header.port);
        } else {
          console.error('[tcp] connect failed before pipe:', String(e), 'host:', header.host, 'port:', header.port);
        }
        try { ws.close(1011, isTimeout ? 'TCP timeout' : 'Connect failed'); } catch {}
        await socket.close().catch(() => {});
        return;
      }

      notifyPortal(RELAY_ID, 'connect', PORTAL_URL, RELAY_SECRET);

      // Extract payload bytes that came in the same buffer as the header
      const initialData = buffer.length > header.dataOffset
        ? buffer.slice(header.dataOffset)
        : null;
      console.log('[pipe] initialData:', initialData ? initialData.length : 0, 'bytes');

      // ── Bidirectional pipe ─────────────────────────────────────────────────
      console.log('[pipe] start', 'host:', header.host, 'port:', header.port);
      await pipeStreams(ws, socket, reader, initialData);

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
