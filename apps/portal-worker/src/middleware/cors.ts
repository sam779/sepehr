import { createMiddleware } from 'hono/factory';
import type { Env } from '../index.js';

const ALLOWED_ORIGINS = new Set([
  'https://sepehr.blackoutobservatory.org',
  'https://sepehr-portal-web.pages.dev',
]);

// Also allow any *.sepehr-portal-web.pages.dev preview deployment
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/[a-z0-9]+\.sepehr-portal-web\.pages\.dev$/.test(origin);
}

export const corsMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const origin = c.req.header('Origin');
  const allowed = isAllowedOrigin(origin);

  if (c.req.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin!,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  await next();

  if (allowed) {
    c.res.headers.set('Access-Control-Allow-Origin', origin!);
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set('Vary', 'Origin');
  }
  return;
});
