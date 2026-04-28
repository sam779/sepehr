/**
 * Cloudflare Workers API client.
 * Handles relay Worker deployment: validate creds → build script → upload → enable subdomain.
 */

import { encryptAES256GCM, sha256hex, generateToken, generateId } from '@sepehr/crypto';
import { buildRelayScript } from './relay-template.js';

const CF_API = 'https://api.cloudflare.com/client/v4';
const COMPATIBILITY_DATE = '2024-09-23';

interface DeployOptions {
  userId: string;
  cfAccountId: string;
  cfApiToken: string;
  db: D1Database;
  encryptionKey: string;
  portalUrl: string;
}

interface DeployResult {
  relayId: string;
  workerName: string;
  workerUrl: string;
}

export async function deployRelayWorker(opts: DeployOptions): Promise<DeployResult> {
  const { userId, cfAccountId, cfApiToken, db, encryptionKey, portalUrl } = opts;

  // Step 1 — Validate token + get workers.dev subdomain
  const subdomain = await getWorkersSubdomain(cfAccountId, cfApiToken);

  // Step 2 — Generate identifiers
  const workerSuffix = generateToken(5).toLowerCase().replace(/[^a-z0-9]/g, 'x').slice(0, 8);
  const workerName = `sepehr-${workerSuffix}`;
  const relayId = generateId();
  const relaySecret = generateToken(32);

  // Step 3 — Build relay script
  const script = buildRelayScript({ relayId, portalUrl, relaySecret });

  // Step 4 — Upload Worker
  await uploadWorker(cfAccountId, workerName, script, cfApiToken);

  // Step 5 — Enable workers.dev subdomain
  await enableWorkersDevSubdomain(cfAccountId, workerName, cfApiToken);

  const workerUrl = `https://${workerName}.${subdomain}.workers.dev`;

  // Step 6 — Encrypt CF API token and persist relay metadata
  const { enc: cfApiTokenEnc, iv: cfIv } = await encryptAES256GCM(cfApiToken, encryptionKey);
  const relaySecretHash = await sha256hex(relaySecret);
  const relayId2 = generateId(); // DB row ID for relay
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO relays
       (id, user_id, worker_name, worker_url, cf_account_id, cf_api_token_enc, cf_iv, relay_secret_hash, relay_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    )
    .bind(relayId2, userId, workerName, workerUrl, cfAccountId, cfApiTokenEnc, cfIv, relaySecretHash, createdAt)
    .run();

  return { relayId: relayId2, workerName, workerUrl };
}

// ─── CF API helpers ───────────────────────────────────────────────────────────

async function getWorkersSubdomain(accountId: string, apiToken: string): Promise<string> {
  const res = await fetch(`${CF_API}/accounts/${accountId}/workers/subdomain`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Invalid Cloudflare API token or insufficient permissions');
  }
  if (!res.ok) {
    throw new Error(`Failed to validate Cloudflare credentials (${res.status})`);
  }

  const data = (await res.json()) as { result?: { subdomain?: string } };
  const subdomain = data.result?.subdomain;
  if (!subdomain) {
    throw new Error('Could not retrieve workers.dev subdomain — ensure Workers are enabled on your account');
  }
  return subdomain;
}

async function uploadWorker(
  accountId: string,
  workerName: string,
  script: string,
  apiToken: string,
): Promise<void> {
  const metadata = {
    main_module: 'index.js',
    compatibility_date: COMPATIBILITY_DATE,
    compatibility_flags: [] as string[],
    bindings: [] as unknown[],
    usage_model: 'bundled',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata');
  form.append('index.js', new Blob([script], { type: 'application/javascript+module' }), 'index.js');

  const res = await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${workerName}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: form,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Worker upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function enableWorkersDevSubdomain(
  accountId: string,
  workerName: string,
  apiToken: string,
): Promise<void> {
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true, previews_enabled: false }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to enable workers.dev subdomain (${res.status}): ${text.slice(0, 200)}`);
  }
}
