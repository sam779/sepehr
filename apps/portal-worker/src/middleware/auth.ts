import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { sha256hex } from '@sepehr/crypto';
import type { Env } from '../index.js';

interface UserRow {
  id: string;
  email: string;
  email_verified: number;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
}

interface Variables {
  userId: string;
  userEmail: string;
}

/**
 * Session auth middleware.
 * Validates the `session` cookie, injects `userId` and `userEmail` into the context.
 */
export const sessionAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    let token = getCookie(c, 'session');

    // If no cookie, try Authorization header: "Bearer <token>"
    if (!token) {
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) return c.json({ ok: false, error: 'Unauthorized' }, 401);

    const tokenHash = await sha256hex(token);
    const now = new Date().toISOString();

    const session = await c.env.DB.prepare(
      'SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?',
    )
      .bind(tokenHash, now)
      .first<SessionRow>();

    if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401);

    const user = await c.env.DB.prepare(
      'SELECT id, email, email_verified FROM users WHERE id = ?',
    )
      .bind(session.user_id)
      .first<UserRow>();

    if (!user) return c.json({ ok: false, error: 'Unauthorized' }, 401);
    if (!user.email_verified) return c.json({ ok: false, error: 'Email not verified' }, 403);

    c.set('userId', user.id);
    c.set('userEmail', user.email);

    await next();
    return;
  },
);

export type { Variables };
