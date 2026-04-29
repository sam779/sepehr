import { Hono } from 'hono';
import { sha224hex, sha256hex, generateToken, generateId, decryptAES256GCM } from '@sepehr/crypto';
import {
  buildTrojanUri,
  buildFullClashConfig,
  buildDebugJson,
  encodeQrData,
  buildShareUrl,
} from '@sepehr/config-schema';
import type { Env } from '../index.js';
import type { Variables } from '../middleware/auth.js';
import { sessionAuth } from '../middleware/auth.js';
import { deployRelayWorker, redeployRelayWorker } from '../lib/cloudflare-api.js';
import type {
  DeployRelayRequest,
  CreateRelayUserRequest,
  PatchRelayUserRequest,
  RelayCheckRequest,
  RelayNotifyRequest,
} from '@sepehr/shared-types';

const MAX_RELAY_USERS = 5;

interface RelayRow {
  id: string;
  user_id: string;
  worker_name: string;
  worker_url: string;
  cf_account_id: string;
  cf_api_token_enc: string;
  cf_iv: string;
  relay_secret_hash: string;
  relay_status: string;
  created_at: string;
}

interface RelayUserRow {
  id: string;
  relay_id: string;
  display_name: string;
  trojan_password: string;
  password_hash: string;
  is_active: number;
  is_paused: number;
  last_seen_at: string | null;
  created_at: string;
}

export const relayRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── GET /api/relay ──────────────────────────────────────────────────────────

relayRoutes.get('/', sessionAuth, async (c) => {
  const userId = c.get('userId');
  const relay = await c.env.DB.prepare(
    'SELECT id, worker_name, worker_url, cf_account_id, relay_status, created_at FROM relays WHERE user_id = ?',
  )
    .bind(userId)
    .first<RelayRow>();

  if (!relay) return c.json({ ok: true, data: null });

  const { count } = (await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM relay_users WHERE relay_id = ? AND is_active = 1',
  )
    .bind(relay.id)
    .first<{ count: number }>()) ?? { count: 0 };

  return c.json({
    ok: true,
    data: {
      id: relay.id,
      workerName: relay.worker_name,
      workerUrl: relay.worker_url,
      cfAccountId: relay.cf_account_id,
      relayStatus: relay.relay_status,
      createdAt: relay.created_at,
      userCount: count,
    },
  });
});

// ─── POST /api/relay/deploy ──────────────────────────────────────────────────

relayRoutes.post('/deploy', sessionAuth, async (c) => {
  const userId = c.get('userId');

  const existing = await c.env.DB.prepare('SELECT id FROM relays WHERE user_id = ?')
    .bind(userId)
    .first();
  if (existing) return c.json({ ok: false, error: 'Relay already deployed' }, 409);

  let body: DeployRelayRequest;
  try {
    body = await c.req.json<DeployRelayRequest>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const { cfAccountId, cfApiToken } = body;
  if (!cfAccountId?.trim() || !cfApiToken?.trim()) {
    return c.json({ ok: false, error: 'cfAccountId and cfApiToken are required' }, 400);
  }

  try {
    const result = await deployRelayWorker({
      userId,
      cfAccountId: cfAccountId.trim(),
      cfApiToken: cfApiToken.trim(),
      db: c.env.DB,
      encryptionKey: c.env.ENCRYPTION_KEY,
      portalUrl: c.env.PORTAL_URL,
    });
    return c.json({ ok: true, data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Deployment failed';
    return c.json({ ok: false, error: message }, 422);
  }
});

// ─── POST /relay/redeploy ─────────────────────────────────────────────────────
// Re-uploads the relay Worker script (latest template + fresh relaySecret).
// Worker URL and family member passwords are preserved — no QR re-scans needed.

relayRoutes.post('/redeploy', sessionAuth, async (c) => {
  const userId = c.get('userId');

  const relay = await c.env.DB.prepare(
    'SELECT id, worker_name, cf_account_id, cf_api_token_enc, cf_iv FROM relays WHERE user_id = ?',
  )
    .bind(userId)
    .first<RelayRow>();

  if (!relay) return c.json({ ok: false, error: 'No relay found' }, 404);

  try {
    await redeployRelayWorker({
      relayId: relay.id,
      workerName: relay.worker_name,
      cfAccountId: relay.cf_account_id,
      cfApiTokenEnc: relay.cf_api_token_enc,
      cfIv: relay.cf_iv,
      db: c.env.DB,
      encryptionKey: c.env.ENCRYPTION_KEY,
      portalUrl: c.env.PORTAL_URL,
    });
    return c.json({ ok: true, data: undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Redeploy failed';
    return c.json({ ok: false, error: message }, 422);
  }
});

// ─── DELETE /api/relay ───────────────────────────────────────────────────────

relayRoutes.delete('/', sessionAuth, async (c) => {
  const userId = c.get('userId');
  const relay = await c.env.DB.prepare(
    'SELECT id, worker_name, cf_account_id, cf_api_token_enc, cf_iv FROM relays WHERE user_id = ?',
  )
    .bind(userId)
    .first<RelayRow>();

  if (!relay) return c.json({ ok: false, error: 'No relay found' }, 404);

  // Best-effort CF API delete — don't fail if it errors
  try {
    const cfApiToken = await decryptAES256GCM(
      relay.cf_api_token_enc,
      relay.cf_iv,
      c.env.ENCRYPTION_KEY,
    );
    await deleteCfWorker(relay.cf_account_id, relay.worker_name, cfApiToken);
  } catch {
    // Proceed with DB cleanup even if CF delete fails
  }

  await c.env.DB.prepare('DELETE FROM relays WHERE id = ?').bind(relay.id).run();

  return c.json({ ok: true, data: undefined });
});

// ─── GET /api/relay/users ────────────────────────────────────────────────────

relayRoutes.get('/users', sessionAuth, async (c) => {
  const userId = c.get('userId');
  const relay = await getRelayForUser(c.env.DB, userId);
  if (!relay) return c.json({ ok: false, error: 'No relay found' }, 404);

  const { results } = await c.env.DB.prepare(
    'SELECT id, display_name, is_active, is_paused, last_seen_at, created_at FROM relay_users WHERE relay_id = ? AND is_active = 1 ORDER BY created_at ASC',
  )
    .bind(relay.id)
    .all<RelayUserRow>();

  return c.json({
    ok: true,
    data: (results ?? []).map(mapRelayUser),
  });
});

// ─── POST /api/relay/users ───────────────────────────────────────────────────

relayRoutes.post('/users', sessionAuth, async (c) => {
  const userId = c.get('userId');
  const relay = await getRelayForUser(c.env.DB, userId);
  if (!relay) return c.json({ ok: false, error: 'No relay found' }, 404);

  const { count } = (await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM relay_users WHERE relay_id = ? AND is_active = 1',
  )
    .bind(relay.id)
    .first<{ count: number }>()) ?? { count: 0 };

  if (count >= MAX_RELAY_USERS) {
    return c.json({ ok: false, error: `Maximum ${MAX_RELAY_USERS} users per relay` }, 422);
  }

  let body: CreateRelayUserRequest;
  try {
    body = await c.req.json<CreateRelayUserRequest>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const displayName = (body.displayName ?? '').trim();
  if (!displayName || displayName.length > 64) {
    return c.json({ ok: false, error: 'displayName is required (max 64 chars)' }, 400);
  }

  const id = generateId();
  const trojanPassword = generateToken(32); // base64url(32 random bytes)
  const passwordHash = sha224hex(trojanPassword); // 56-char hex — what Trojan clients send
  const createdAt = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO relay_users (id, relay_id, display_name, trojan_password, password_hash, is_active, is_paused, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?)',
  )
    .bind(id, relay.id, displayName, trojanPassword, passwordHash, createdAt)
    .run();

  const workerHost = new URL(relay.worker_url).hostname;
  const config = buildUserConfig(trojanPassword, workerHost, displayName);

  return c.json({ ok: true, data: { id, relayId: relay.id, displayName, createdAt, ...config } }, 201);
});

// ─── DELETE /api/relay/users/:id ─────────────────────────────────────────────

relayRoutes.delete('/users/:id', sessionAuth, async (c) => {
  const userId = c.get('userId');
  const relay = await getRelayForUser(c.env.DB, userId);
  if (!relay) return c.json({ ok: false, error: 'No relay found' }, 404);

  const userRow = await c.env.DB.prepare(
    'SELECT id FROM relay_users WHERE id = ? AND relay_id = ?',
  )
    .bind(c.req.param('id'), relay.id)
    .first<{ id: string }>();

  if (!userRow) return c.json({ ok: false, error: 'User not found' }, 404);

  // Soft delete
  await c.env.DB.prepare('UPDATE relay_users SET is_active = 0 WHERE id = ?')
    .bind(userRow.id)
    .run();

  return c.json({ ok: true, data: undefined });
});

// ─── PATCH /api/relay/users/:id ──────────────────────────────────────────────

relayRoutes.patch('/users/:id', sessionAuth, async (c) => {
  const userId = c.get('userId');
  const relay = await getRelayForUser(c.env.DB, userId);
  if (!relay) return c.json({ ok: false, error: 'No relay found' }, 404);

  const userRow = await c.env.DB.prepare(
    'SELECT id, display_name, is_paused FROM relay_users WHERE id = ? AND relay_id = ? AND is_active = 1',
  )
    .bind(c.req.param('id'), relay.id)
    .first<RelayUserRow>();

  if (!userRow) return c.json({ ok: false, error: 'User not found' }, 404);

  let body: PatchRelayUserRequest;
  try {
    body = await c.req.json<PatchRelayUserRequest>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const updates: string[] = [];
  const binds: unknown[] = [];

  if (body.displayName !== undefined) {
    const name = body.displayName.trim();
    if (!name || name.length > 64) return c.json({ ok: false, error: 'Invalid displayName' }, 400);
    updates.push('display_name = ?');
    binds.push(name);
  }
  if (body.isPaused !== undefined) {
    updates.push('is_paused = ?');
    binds.push(body.isPaused ? 1 : 0);
  }

  if (updates.length === 0) return c.json({ ok: false, error: 'Nothing to update' }, 400);

  binds.push(userRow.id);
  await c.env.DB.prepare(
    `UPDATE relay_users SET ${updates.join(', ')} WHERE id = ?`,
  )
    .bind(...binds)
    .run();

  return c.json({ ok: true, data: undefined });
});

// ─── GET /api/relay/users/:id/config ─────────────────────────────────────────

relayRoutes.get('/users/:id/config', sessionAuth, async (c) => {
  const userId = c.get('userId');
  const relay = await getRelayForUser(c.env.DB, userId);
  if (!relay) return c.json({ ok: false, error: 'No relay found' }, 404);

  const userRow = await c.env.DB.prepare(
    'SELECT id, display_name, trojan_password FROM relay_users WHERE id = ? AND relay_id = ? AND is_active = 1',
  )
    .bind(c.req.param('id'), relay.id)
    .first<RelayUserRow>();

  if (!userRow) return c.json({ ok: false, error: 'User not found' }, 404);

  const workerHost = new URL(relay.worker_url).hostname;
  const config = buildUserConfig(userRow.trojan_password, workerHost, userRow.display_name);

  return c.json({ ok: true, data: config });
});

// ─── POST /api/relay/users/:id/rotate ────────────────────────────────────────

relayRoutes.post('/users/:id/rotate', sessionAuth, async (c) => {
  const userId = c.get('userId');
  const relay = await getRelayForUser(c.env.DB, userId);
  if (!relay) return c.json({ ok: false, error: 'No relay found' }, 404);

  const userRow = await c.env.DB.prepare(
    'SELECT id, display_name FROM relay_users WHERE id = ? AND relay_id = ? AND is_active = 1',
  )
    .bind(c.req.param('id'), relay.id)
    .first<RelayUserRow>();

  if (!userRow) return c.json({ ok: false, error: 'User not found' }, 404);

  const newPassword = generateToken(32);
  const newPasswordHash = sha224hex(newPassword);
  await c.env.DB.prepare('UPDATE relay_users SET trojan_password = ?, password_hash = ? WHERE id = ?')
    .bind(newPassword, newPasswordHash, userRow.id)
    .run();

  const workerHost = new URL(relay.worker_url).hostname;
  const config = buildUserConfig(newPassword, workerHost, userRow.display_name);

  return c.json({ ok: true, data: config });
});

// ─── POST /api/relay/check  (relay → portal, auth: Bearer <relay_secret>) ────

relayRoutes.post('/check', async (c) => {
  const authHeader = c.req.header('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }
  const providedSecret = authHeader.slice(7);

  let body: RelayCheckRequest;
  try {
    body = await c.req.json<RelayCheckRequest>();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  // Relay sends { hash, relay_id } where hash = SHA224(trojanPassword)
  const { hash, relay_id } = body;
  if (!hash || !relay_id) return c.json({ valid: false, paused: false });

  // Verify relay secret
  const relay = await c.env.DB.prepare(
    'SELECT relay_secret_hash FROM relays WHERE id = ?',
  )
    .bind(relay_id)
    .first<{ relay_secret_hash: string }>();

  if (!relay) return c.json({ valid: false, paused: false });

  const secretHash = await sha256hex(providedSecret);
  if (secretHash !== relay.relay_secret_hash) return c.json({ valid: false, paused: false });

  // Compare incoming SHA224 hash directly against stored password_hash
  const user = await c.env.DB.prepare(
    'SELECT is_paused FROM relay_users WHERE password_hash = ? AND relay_id = ? AND is_active = 1 LIMIT 1',
  )
    .bind(hash, relay_id)
    .first<{ is_paused: number }>();

  if (!user) return c.json({ valid: false, paused: false });

  return c.json({ valid: true, paused: user.is_paused === 1 });
});

// ─── POST /api/relay/notify  (relay → portal, auth: Bearer <relay_secret>) ───

relayRoutes.post('/notify', async (c) => {
  const authHeader = c.req.header('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return c.json({ ok: false }, 401);
  const providedSecret = authHeader.slice(7);

  let body: RelayNotifyRequest;
  try {
    body = await c.req.json<RelayNotifyRequest>();
  } catch {
    return c.json({ ok: false }, 400);
  }

  const { relay_id } = body;
  if (!relay_id) return c.json({ ok: false }, 400);

  const relay = await c.env.DB.prepare(
    'SELECT relay_secret_hash FROM relays WHERE id = ?',
  )
    .bind(relay_id)
    .first<{ relay_secret_hash: string }>();

  if (!relay) return c.json({ ok: false }, 404);

  const secretHash = await sha256hex(providedSecret);
  if (secretHash !== relay.relay_secret_hash) return c.json({ ok: false }, 401);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE relay_users
     SET last_seen_at = ?
     WHERE relay_id = ? AND is_active = 1 AND is_paused = 0
     ORDER BY last_seen_at DESC NULLS LAST
     LIMIT 1`,
  )
    .bind(now, relay_id)
    .run();

  return c.json({ ok: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getRelayForUser(db: D1Database, userId: string): Promise<RelayRow | null> {
  return db
    .prepare(
      'SELECT id, worker_url FROM relays WHERE user_id = ?',
    )
    .bind(userId)
    .first<RelayRow>();
}

function buildUserConfig(
  trojanPassword: string,
  workerHost: string,
  displayName: string,
): {
  trojanUri: string;
  clashYaml: string;
  debugJson: Record<string, unknown>;
  qrData: string;
  shareUrl: string;
} {
  const trojanUri = buildTrojanUri({ password: trojanPassword, host: workerHost, displayName });
  return {
    trojanUri,
    clashYaml: buildFullClashConfig({ password: trojanPassword, host: workerHost, name: displayName }),
    debugJson: buildDebugJson({ password: trojanPassword, host: workerHost }),
    qrData: encodeQrData(trojanUri),
    shareUrl: buildShareUrl(trojanUri),
  };
}

function mapRelayUser(row: RelayUserRow) {
  return {
    id: row.id,
    relayId: row.relay_id,
    displayName: row.display_name,
    isActive: row.is_active === 1,
    isPaused: row.is_paused === 1,
    lastSeenAt: row.last_seen_at ?? null,
    createdAt: row.created_at,
  };
}

async function deleteCfWorker(
  accountId: string,
  workerName: string,
  apiToken: string,
): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`CF delete failed: ${res.status}`);
  }
}
