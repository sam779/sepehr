import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors.js';
import { authRoutes } from './routes/auth.js';
import { relayRoutes } from './routes/relay.js';

export interface Env {
  DB: D1Database;
  ENCRYPTION_KEY: string;
  RESEND_API_KEY: string;
  PORTAL_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', corsMiddleware);

app.route('/auth', authRoutes);
app.route('/relay', relayRoutes);

app.get('/health', (c) => c.json({ ok: true }));

app.notFound((c) => c.json({ ok: false, error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ ok: false, error: 'Internal server error' }, 500);
});

export default app;
