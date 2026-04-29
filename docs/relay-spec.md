# Relay Protocol Specification

This document describes the Trojan-over-WebSocket relay Worker and its interaction with the portal.

---

## Overview

Each user's relay is a Cloudflare Worker deployed to their own Cloudflare account. It accepts incoming WebSocket connections from proxy clients (Shadowrocket, v2rayNG, Clash) using the Trojan protocol over WebSocket+TLS, and forwards traffic to the open internet using `cloudflare:sockets`.

The relay is fully self-contained in Cloudflare infrastructure:
- Inbound runtime: Cloudflare Workers
- Outbound TCP: `cloudflare:sockets`
- Auth/metadata checks: portal Worker + D1
- No VPS, no external relay servers, no multi-hop layers

---

## WebSocket endpoint

```
GET wss://<relay-subdomain>.workers.dev/trojan
Upgrade: websocket
```

The worker accepts WebSocket upgrade requests at `/trojan`. All other paths return appropriate HTTP responses.

---

## Trojan wire format

After the WebSocket handshake, the client sends the first frame containing:

```
+---------+--------+----+----------+----------+\r\n+--------+---------+
|  PWD    | CRLF   |CMD | ATYP     |  ADDR    | PORT  | PAYLOAD  |
+---------+--------+----+----------+----------+-------+----------+
| N bytes | 2      | 1  | 1        | variable | 2 BE  | variable |
```

### Password

- Trojan clients send `SHA224(password)` as a lowercase 56-char hex string
- Relay forwards this value to portal unchanged as `hash`
- Portal compares `hash` against `relay_users.password_hash`

### CMD

| Value | Meaning |
|-------|---------|
| `0x01` | CONNECT (TCP) |
| `0x03` | UDP ASSOCIATE — relay closes with WS 1003 (not supported) |

### ATYP (address type)

| Value | Address format |
|-------|---------------|
| `0x01` | IPv4 (4 bytes) |
| `0x03` | Domain (1-byte length prefix + N bytes) |
| `0x04` | IPv6 (16 bytes) |

### Guards

The relay enforces these guards on the first frame:

- First frame larger than 16 KB → close WS immediately
- No `\r\n` in expected position → close
- Empty password → close
- Unknown ATYP → close
- Insufficient bytes for address/port → close

---

## SSRF protection

Before connecting to any address, the relay validates:

### IPv4 blocked ranges

```
0.0.0.0/8        – invalid
10.0.0.0/8       – RFC 1918
127.0.0.0/8      – loopback
169.254.0.0/16   – link-local / cloud metadata
172.16.0.0/12    – RFC 1918
192.168.0.0/16   – RFC 1918
168.63.129.16/32 – Azure IMDS
```

### IPv6 blocked

- `::1` (loopback)
- `fe80::/10` (link-local)

### Domain blocking

- `localhost`
- `*.local`
- `*.internal`
- `metadata.*`
- `*.amazonaws.com`
- Any label that is all digits (e.g. `169.254.169.254`)
- Labels exceeding 253 characters total
- Labels not matching `[a-zA-Z0-9._-]+`

---

## Authentication

### Per-connection auth check

On each new WebSocket connection, after parsing the Trojan header, the relay calls the portal:

```
POST https://<portal-url>/relay/check
Authorization: Bearer <relaySecret>
Content-Type: application/json

{
  "relay_id": "...",
  "hash": "<sha224 from Trojan first line>"
}
```

Response (current runtime shape):
```json
{ "valid": true, "paused": false }
```

- Timeout: 500 ms
- On timeout or error: **fail-open** (allow connection) — prevents portal downtime from affecting users

### Relay-to-portal auth

The relay secret is a 32-byte random token generated at deploy time. It is:
- Stored as `relays.relay_secret_hash` (SHA-256) in D1
- Baked into the relay Worker script as a constant (not an env var)
- Sent as `Authorization: Bearer <relaySecret>` on every `/check` and `/notify` call

---

## Portal notifications

After a connection is authenticated, the relay fires a notification (fire-and-forget):

```
POST https://<portal-url>/relay/notify
Authorization: Bearer <relaySecret>
Content-Type: application/json

{
  "relay_id": "...",
  "event": "connect"
}
```

The portal updates `last_seen_at` for active, non-paused users on the relay. Failures are silently ignored.

---

## Rate limiting

In-memory per-IP rate limit on the relay: **10 WebSocket connections per 5 minutes**.

- Uses a `Map<string, {count, resetAt}>` in Worker memory
- Memory is per-isolate, not globally shared
- On limit exceeded: HTTP 429 before WebSocket upgrade

---

## Streaming

After authentication and SSRF checks:

1. Relay opens a TCP socket via `cloudflare:sockets` to the target host:port
2. Relay waits for `socket.opened` before starting any stream piping
3. If socket readiness exceeds 5s, relay fails fast (`[tcp] timeout`) and closes both sides
4. The initial payload (bytes after the Trojan header) is sent first to preserve order
5. Bidirectional stream via Web Streams:
   - WS messages → TCP socket
   - TCP socket → WS messages
6. Idle timeout: **5 minutes** (no data in either direction)
7. Hard timeout: **1 hour** (absolute connection limit)
8. On any close/error: `closeBothSides()` runs in `finally` block

---

## Health endpoint

```
GET https://<relay-subdomain>.workers.dev/health
→ 200 OK
{"ok":true}
```

Used by the portal to verify a newly-deployed relay is live.

---

## Deployed Worker structure

The relay script is a self-contained ES module with no external imports (except `cloudflare:sockets`). It is generated by `buildRelayScript()` in the portal Worker's `relay-template.ts` and uploaded via the Cloudflare Workers REST API at deploy time.

Constants baked into the script:
- `RELAY_ID` — UUID identifying this relay in D1
- `PORTAL_URL` — portal API base URL
- `RELAY_SECRET` — authentication secret for portal callbacks
