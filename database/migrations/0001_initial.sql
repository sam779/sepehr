-- Migration 0001: Initial schema
-- Sepehr portal database

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- One relay per user (one-to-one).
-- relay_secret_hash: SHA-256(relaySecret) — used to authenticate relay→portal calls.
CREATE TABLE IF NOT EXISTS relays (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  worker_name       TEXT NOT NULL,
  worker_url        TEXT NOT NULL,
  cf_account_id     TEXT NOT NULL,
  cf_api_token_enc  TEXT NOT NULL,
  cf_iv             TEXT NOT NULL,
  relay_secret_hash TEXT NOT NULL,
  relay_status      TEXT NOT NULL DEFAULT 'active',
  created_at        TEXT NOT NULL
);

-- Up to 5 relay users per relay.
-- trojan_password is base64url(trojan_secret), stored plaintext.
-- Never returned by API after initial creation.
CREATE TABLE IF NOT EXISTS relay_users (
  id             TEXT PRIMARY KEY,
  relay_id       TEXT NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  trojan_password TEXT NOT NULL,
  password_hash  TEXT NOT NULL DEFAULT '',
  is_active      INTEGER NOT NULL DEFAULT 1,
  is_paused      INTEGER NOT NULL DEFAULT 0,
  is_connected   INTEGER NOT NULL DEFAULT 0,
  last_seen_at   TEXT,
  connection_country TEXT,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_hash          ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_relay_users_password   ON relay_users(trojan_password);
CREATE INDEX IF NOT EXISTS idx_relay_users_password_hash ON relay_users(password_hash);
CREATE INDEX IF NOT EXISTS idx_relay_users_relay      ON relay_users(relay_id);
CREATE INDEX IF NOT EXISTS idx_relays_secret          ON relays(relay_secret_hash);
