import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { pbkdf2Hash, pbkdf2Verify, sha256hex, generateToken, generateId } from '@sepehr/crypto';
import type { Env } from '../index.js';
import type { Variables } from '../middleware/auth.js';
import { sessionAuth } from '../middleware/auth.js';
import { sendVerificationEmail } from '../lib/email.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import type {
  SignupRequest,
  LoginRequest,
  VerifyEmailRequest,
  ResendVerificationRequest,
} from '@sepehr/shared-types';

const AUTH_RATE_LIMIT_MAX = 10;
const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CODE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified: number;
  created_at: string;
}

interface VerificationRow {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: string;
  used: number;
}

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

authRoutes.post('/signup', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const limited = await checkRateLimit(
    c.env.DB,
    `signup:${ip}`,
    AUTH_RATE_LIMIT_MAX,
    AUTH_RATE_LIMIT_WINDOW_MS,
  );
  if (limited) return c.json({ ok: false, error: 'Too many requests' }, 429);

  let body: SignupRequest;
  try {
    body = await c.req.json<SignupRequest>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!isValidEmail(email)) return c.json({ ok: false, error: 'Invalid email' }, 400);
  if (password.length < 8) return c.json({ ok: false, error: 'Password too short' }, 400);
  if (password.length > 128) return c.json({ ok: false, error: 'Password too long' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (existing) return c.json({ ok: false, error: 'Email already registered' }, 409);

  const id = generateId();
  const passwordHash = await pbkdf2Hash(password);
  const createdAt = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, email_verified, created_at) VALUES (?, ?, ?, 0, ?)',
  )
    .bind(id, email, passwordHash, createdAt)
    .run();

  await issueVerificationCode(c.env.DB, id, email, c.env.RESEND_API_KEY);

  return c.json({ ok: true, data: undefined }, 201);
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────

authRoutes.post('/verify-email', async (c) => {
  let body: VerifyEmailRequest;
  try {
    body = await c.req.json<VerifyEmailRequest>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const code = (body.code ?? '').trim();

  const user = await c.env.DB.prepare('SELECT id, email_verified FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>();
  if (!user) return c.json({ ok: false, error: 'Invalid code' }, 400);
  if (user.email_verified) return c.json({ ok: false, error: 'Already verified' }, 400);

  const verification = await c.env.DB.prepare(
    'SELECT id, code_hash, expires_at, used FROM email_verifications WHERE user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
  )
    .bind(user.id)
    .first<VerificationRow>();

  if (!verification) return c.json({ ok: false, error: 'Invalid code' }, 400);
  if (new Date(verification.expires_at) < new Date())
    return c.json({ ok: false, error: 'Code expired' }, 400);

  const codeHash = await sha256hex(code);
  if (codeHash !== verification.code_hash) return c.json({ ok: false, error: 'Invalid code' }, 400);

  // Mark verification used and user verified in a batch
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').bind(verification.id),
    c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(user.id),
  ]);

  const token = await createSession(c.env.DB, user.id);
  setSessionCookie(c, token);

  return c.json({
    ok: true,
    data: { id: user.id, email, emailVerified: true },
  });
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────

authRoutes.post('/resend-verification', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const limited = await checkRateLimit(
    c.env.DB,
    `resend:${ip}`,
    5,
    60 * 60 * 1000,
  );
  if (limited) return c.json({ ok: false, error: 'Too many requests' }, 429);

  let body: ResendVerificationRequest;
  try {
    body = await c.req.json<ResendVerificationRequest>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const user = await c.env.DB.prepare(
    'SELECT id, email_verified FROM users WHERE email = ?',
  )
    .bind(email)
    .first<UserRow>();

  // Always return 200 to avoid email enumeration
  if (!user || user.email_verified) return c.json({ ok: true, data: undefined });

  await issueVerificationCode(c.env.DB, user.id, email, c.env.RESEND_API_KEY);

  return c.json({ ok: true, data: undefined });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRoutes.post('/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const limited = await checkRateLimit(
    c.env.DB,
    `login:${ip}`,
    AUTH_RATE_LIMIT_MAX,
    AUTH_RATE_LIMIT_WINDOW_MS,
  );
  if (limited) return c.json({ ok: false, error: 'Too many requests' }, 429);

  let body: LoginRequest;
  try {
    body = await c.req.json<LoginRequest>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, email_verified FROM users WHERE email = ?',
  )
    .bind(email)
    .first<UserRow>();

  // Always hash even if user not found (prevent timing oracle)
  const dummyHash = 'pbkdf2:5000:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
  const storedHash = user?.password_hash ?? dummyHash;
  const valid = await pbkdf2Verify(password, storedHash);

  if (!user || !valid) return c.json({ ok: false, error: 'Invalid credentials' }, 401);
  if (!user.email_verified) return c.json({ ok: false, error: 'Email not verified' }, 403);

  const token = await createSession(c.env.DB, user.id);
  setSessionCookie(c, token);

  return c.json({
    ok: true,
    data: { id: user.id, email: user.email, emailVerified: true },
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRoutes.post('/logout', sessionAuth, async (c) => {
  const token = c.req.header('Cookie')
    ?.split(';')
    .find((s) => s.trim().startsWith('session='))
    ?.split('=')[1]
    ?.trim();

  if (token) {
    const tokenHash = await sha256hex(token);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  deleteCookie(c, 'session', { path: '/' });
  return c.json({ ok: true, data: undefined });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRoutes.get('/me', sessionAuth, (c) => {
  return c.json({
    ok: true,
    data: {
      id: c.get('userId'),
      email: c.get('userEmail'),
      emailVerified: true,
    },
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = generateToken(32);
  const tokenHash = await sha256hex(token);
  const id = generateId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, userId, tokenHash, expiresAt, createdAt)
    .run();

  return token;
}

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string): void {
  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    expires: new Date(Date.now() + SESSION_DURATION_MS),
  });
}

async function issueVerificationCode(
  db: D1Database,
  userId: string,
  email: string,
  resendApiKey: string,
): Promise<void> {
  const code = generateNumericCode();
  const codeHash = await sha256hex(code);
  const id = generateId();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS).toISOString();
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      'INSERT INTO email_verifications (id, user_id, code_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    )
    .bind(id, userId, codeHash, expiresAt, createdAt)
    .run();

  await sendVerificationEmail({ to: email, code, resendApiKey });
}

function generateNumericCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const num = (((bytes[0] ?? 0) << 16) | ((bytes[1] ?? 0) << 8) | (bytes[2] ?? 0)) % 1_000_000;
  return String(num).padStart(6, '0');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
