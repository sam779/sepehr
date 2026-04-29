/**
 * Session token verification for VPS relay.
 *
 * The Cloudflare relay Worker generates tokens with:
 *   payload = JSON.stringify({ host, port, expiry, nonce })
 *   signature = HMAC-SHA256(VPS_TUNNEL_SECRET, payload)
 *   token = base64url(JSON.stringify({ payload, sig }))
 *
 * The VPS verifies the signature and expiry locally using the same shared secret.
 * No round-trip to the portal is needed.
 */

import { createHmac } from 'node:crypto';

export interface SessionClaims {
  host: string;
  port: number;
  expiry: number; // ms since epoch
  nonce: string;
}

export interface VerifyResult {
  ok: true;
  claims: SessionClaims;
}

export interface VerifyError {
  ok: false;
  reason: string;
}

function base64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64').toString('utf8');
}

function hmacSha256Hex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

// Constant-time hex string comparison to prevent timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function verifySessionToken(
  token: string,
  secret: string,
): VerifyResult | VerifyError {
  try {
    const raw = base64urlDecode(token);
    const { payload, sig } = JSON.parse(raw) as { payload?: string; sig?: string };

    if (typeof payload !== 'string' || typeof sig !== 'string') {
      return { ok: false, reason: 'malformed token structure' };
    }

    const expectedSig = hmacSha256Hex(secret, payload);
    if (!safeEqual(expectedSig, sig)) {
      return { ok: false, reason: 'invalid signature' };
    }

    const claims = JSON.parse(payload) as Partial<SessionClaims>;
    if (
      typeof claims.host !== 'string' ||
      typeof claims.port !== 'number' ||
      typeof claims.expiry !== 'number' ||
      typeof claims.nonce !== 'string'
    ) {
      return { ok: false, reason: 'malformed claims' };
    }

    if (Date.now() > claims.expiry) {
      return { ok: false, reason: 'token expired' };
    }

    return { ok: true, claims: claims as SessionClaims };
  } catch {
    return { ok: false, reason: 'parse error' };
  }
}
