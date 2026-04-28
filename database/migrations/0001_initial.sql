-- Migration 0001: Initial schema
-- Sepehr portal database

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE email_verifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- One relay per user (one-to-one).
-- relay_secret_hash: SHA-256(relaySecret) — used to authenticate relay→portal calls.
CREATE TABLE relays (
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
CREATE TABLE relay_users (
  id             TEXT PRIMARY KEY,
  relay_id       TEXT NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  trojan_password TEXT NOT NULL,
  is_active      INTEGER NOT NULL DEFAULT 1,
  is_paused      INTEGER NOT NULL DEFAULT 0,
  last_seen_at   TEXT,
  created_at     TEXT NOT NULL
);

CREATE INDEX idx_sessions_hash          ON sessions(token_hash);
CREATE INDEX idx_relay_users_password   ON relay_users(trojan_password);
CREATE INDEX idx_relay_users_relay      ON relay_users(relay_id);
CREATE INDEX idx_relays_secret          ON relays(relay_secret_hash);
