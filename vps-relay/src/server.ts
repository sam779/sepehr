/**
 * VPS Relay Server — Sepehr data plane.
 *
 * Accepts WebSocket connections from Cloudflare relay Workers.
 * Each connection carries a signed session token identifying the target
 * host:port.  After token verification and SSRF checks, a TCP connection
 * is opened and bidirectional piping begins.
 *
 * Environment variables:
 *   PORT               — listening port (default 8080; put nginx/caddy on 443)
 *   VPS_TUNNEL_SECRET  — HMAC secret shared with Cloudflare relay Workers
 *   ALLOWED_ORIGINS    — comma-separated list of allowed WS Origin headers
 *                        (optional, skipped if unset)
 *
 * Start:
 *   VPS_TUNNEL_SECRET=<secret> node dist/server.js
 */

import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { verifySessionToken } from './auth.js';
import { isBlockedHost, isBlockedPort } from './ssrf.js';
import { createTunnel } from './tunnel.js';

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);
const VPS_TUNNEL_SECRET = process.env['VPS_TUNNEL_SECRET'] ?? '';
const ALLOWED_ORIGINS = process.env['ALLOWED_ORIGINS']?.split(',').map((s) => s.trim()) ?? [];

if (!VPS_TUNNEL_SECRET) {
  console.error('[startup] FATAL: VPS_TUNNEL_SECRET is not set');
  process.exit(1);
}

// ─── Per-IP connection rate limit ────────────────────────────────────────────
const connMap = new Map<string, { count: number; windowStart: number }>();
const CONN_MAX = 20;
const CONN_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = connMap.get(ip);
  if (!entry || now - entry.windowStart > CONN_WINDOW_MS) {
    connMap.set(ip, { count: 1, windowStart: now });
    return false; // not rate-limited
  }
  entry.count++;
  return entry.count > CONN_MAX;
}

// ─── HTTP server (health endpoint + WS upgrade) ───────────────────────────────
const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// ─── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/tunnel' });

wss.on('connection', (ws: WebSocket, req) => {
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown';

  console.log(`[ws] connection  ip=${ip}`);

  // ── Origin check (optional) ────────────────────────────────────────────────
  if (ALLOWED_ORIGINS.length > 0) {
    const origin = req.headers['origin'] ?? '';
    if (!ALLOWED_ORIGINS.includes(origin)) {
      console.warn(`[ws] rejected origin=${origin}  ip=${ip}`);
      ws.close(4003, 'Forbidden');
      return;
    }
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  if (checkRateLimit(ip)) {
    console.warn(`[ws] rate limited  ip=${ip}`);
    ws.close(4029, 'Rate limit exceeded');
    return;
  }

  // ── Handshake: wait for first text message with connect command ────────────
  const handshakeTimeout = setTimeout(() => {
    console.warn(`[ws] handshake timeout  ip=${ip}`);
    ws.close(4008, 'Handshake timeout');
  }, 10_000);

  const onHandshake = (rawData: Buffer | ArrayBuffer | Buffer[]) => {
    clearTimeout(handshakeTimeout);
    ws.removeListener('message', onHandshake);

    let msg: { type?: string; token?: string; host?: string; port?: unknown };
    try {
      const text = Buffer.isBuffer(rawData)
        ? rawData.toString('utf8')
        : Buffer.from(rawData as ArrayBuffer).toString('utf8');
      msg = JSON.parse(text) as typeof msg;
    } catch {
      console.warn(`[ws] bad handshake json  ip=${ip}`);
      ws.close(4400, 'Bad handshake');
      return;
    }

    if (msg.type !== 'connect') {
      console.warn(`[ws] unexpected type=${msg.type}  ip=${ip}`);
      ws.close(4400, 'Expected connect');
      return;
    }

    if (typeof msg.token !== 'string') {
      ws.close(4401, 'Missing token');
      return;
    }

    // ── Token verification ──────────────────────────────────────────────────
    const result = verifySessionToken(msg.token, VPS_TUNNEL_SECRET);
    if (!result.ok) {
      console.warn(`[auth] rejected  reason=${result.reason}  ip=${ip}`);
      ws.close(4401, `Unauthorized: ${result.reason}`);
      return;
    }

    const { host, port } = result.claims;
    console.log(`[auth] accepted  host=${host} port=${port}  ip=${ip}`);

    // ── SSRF protection ──────────────────────────────────────────────────────
    if (isBlockedHost(host)) {
      console.warn(`[ssrf] blocked host=${host}  ip=${ip}`);
      ws.close(4403, 'Blocked host');
      return;
    }
    if (isBlockedPort(port)) {
      console.warn(`[ssrf] blocked port=${port}  ip=${ip}`);
      ws.close(4403, 'Blocked port');
      return;
    }

    // ── Everything checks out — open TCP tunnel ──────────────────────────────
    createTunnel(ws, host, port);
  };

  ws.on('message', onHandshake);

  ws.on('error', (err: Error) => {
    clearTimeout(handshakeTimeout);
    console.error(`[ws] error before handshake  ip=${ip}  err=${err.message}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[startup] VPS relay listening on port ${PORT}`);
  console.log(`[startup] tunnel endpoint: ws://0.0.0.0:${PORT}/tunnel`);
});

process.on('SIGTERM', () => {
  console.log('[shutdown] SIGTERM received — closing server');
  wss.close();
  httpServer.close();
});
