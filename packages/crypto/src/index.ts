/**
 * @sepehr/crypto
 *
 * Crypto utilities built entirely on the Web Crypto API.
 * Works in Cloudflare Workers, modern browsers, and Node.js 18+.
 * No external dependencies. No SHA-224.
 */

const PBKDF2_ITERATIONS = 5000;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_KEY_BYTES = 32; // 256 bits

// ─── PBKDF2 ─────────────────────────────────────────────────────────────────

/**
 * Hash a portal user password.
 * Returns an opaque string: `pbkdf2:<iterations>:<salt_hex>:<hash_hex>`
 */
export async function pbkdf2Hash(password: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const salt = crypto.getRandomValues(new Uint8Array(16) as Uint8Array<ArrayBuffer>);

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: PBKDF2_HASH, salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    PBKDF2_KEY_BYTES * 8,
  );

  return `pbkdf2:${PBKDF2_ITERATIONS}:${bufToHex(salt)}:${bufToHex(new Uint8Array(bits))}`;
}

/**
 * Verify a portal user password against a stored hash.
 * Uses constant-time byte comparison to prevent timing attacks.
 */
export async function pbkdf2Verify(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = parseInt(parts[1] ?? '0', 10);
  const salt = hexToBuf(parts[2] ?? '');
  const expectedHash = hexToBuf(parts[3] ?? '');
  if (salt.length === 0 || expectedHash.length === 0) return false;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: PBKDF2_HASH, salt, iterations },
    keyMaterial,
    expectedHash.length * 8,
  );

  const actualHash = new Uint8Array(bits);

  // Constant-time comparison
  if (actualHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) {
    diff |= (actualHash[i] ?? 0) ^ (expectedHash[i] ?? 0);
  }
  return diff === 0;
}

// ─── AES-256-GCM ────────────────────────────────────────────────────────────

/**
 * Encrypt plaintext with AES-256-GCM.
 * @param plaintext  UTF-8 string to encrypt.
 * @param keyB64     Base64url-encoded 32-byte key (from ENCRYPTION_KEY env secret).
 * @returns          `{enc, iv}` both base64url-encoded.
 */
export async function encryptAES256GCM(
  plaintext: string,
  keyB64: string,
): Promise<{ enc: string; iv: string }> {
  const key = await crypto.subtle.importKey('raw', base64urlToBytes(keyB64), 'AES-GCM', false, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { enc: bytesToBase64url(new Uint8Array(encrypted)), iv: bytesToBase64url(iv) };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 */
export async function decryptAES256GCM(
  enc: string,
  iv: string,
  keyB64: string,
): Promise<string> {
  const key = await crypto.subtle.importKey('raw', base64urlToBytes(keyB64), 'AES-GCM', false, [
    'decrypt',
  ]);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64urlToBytes(iv) },
    key,
    base64urlToBytes(enc),
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Hashing ─────────────────────────────────────────────────────────────────

/**
 * SHA-224 digest returned as lowercase hex (56 chars).
 *
 * Pure-JS implementation — Cloudflare Workers' Web Crypto does not support
 * SHA-224, so we cannot use crypto.subtle here.
 *
 * SHA-224 is SHA-256 with different initial hash values and a truncated (224-bit)
 * output.  Reference: FIPS PUB 180-4.
 */
export function sha224hex(data: string): string {
  const enc = new TextEncoder();
  const bytes = enc.encode(data);

  // SHA-224 initial hash values (first 32 bits of the fractional parts of the
  // square roots of the 9th through 16th primes).
  let h0 = 0xc1059ed8 | 0;
  let h1 = 0x367cd507 | 0;
  let h2 = 0x3070dd17 | 0;
  let h3 = 0xf70e5939 | 0;
  let h4 = 0xffc00b31 | 0;
  let h5 = 0x68581511 | 0;
  let h6 = 0x64f98fa7 | 0;
  let h7 = 0xbefa4fa4 | 0;

  // SHA-256 round constants
  const K = new Int32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  // Pre-processing: add padding bits
  const msgLen = bytes.length;
  const bitLen = msgLen * 8;
  // Pad to 448 bits mod 512 (i.e. 56 bytes mod 64), then append 8-byte big-endian length
  const padLen = ((msgLen % 64) < 56 ? 56 - (msgLen % 64) : 120 - (msgLen % 64));
  const padded = new Uint8Array(msgLen + padLen + 8);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  // big-endian 64-bit length (we only use lower 32 bits since msgLen fits)
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);

  // Process each 512-bit (64-byte) chunk
  const W = new Int32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = dv.getInt32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15]!;
      const w2  = W[i - 2]!;
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2  >>> 17) | (w2  << 15)) ^ ((w2  >>> 19) | (w2  << 13)) ^ (w2  >>> 10);
      W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1  = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch  = (e & f) ^ (~e & g);
      const tmp1 = (h + S1 + ch + K[i]! + W[i]!) | 0;
      const S0  = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const tmp2 = (S0 + maj) | 0;

      h = g; g = f; f = e; e = (d + tmp1) | 0;
      d = c; c = b; b = a; a = (tmp1 + tmp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  // SHA-224 truncates to first 7 words (224 bits)
  const result = new Uint32Array([h0, h1, h2, h3, h4, h5, h6]);
  const out = new Uint8Array(28);
  const outDv = new DataView(out.buffer);
  for (let i = 0; i < 7; i++) outDv.setUint32(i * 4, result[i]!, false);
  return bufToHex(out);
}

/** SHA-256 digest returned as lowercase hex. */
export async function sha256hex(data: string | Uint8Array): Promise<string> {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', input as Uint8Array<ArrayBuffer>)));
}

// ─── Token / ID generation ───────────────────────────────────────────────────

/** Cryptographically random base64url-encoded token. Default 32 bytes = 256 bits. */
export function generateToken(bytes = 32): string {
  return bytesToBase64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** RFC 4122 v4 UUID. */
export function generateId(): string {
  return crypto.randomUUID();
}

// ─── Base64url helpers (exported for use in relay template) ──────────────────

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64urlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padding));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) return new Uint8Array(new ArrayBuffer(0));
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
