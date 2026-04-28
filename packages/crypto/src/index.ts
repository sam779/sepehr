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
