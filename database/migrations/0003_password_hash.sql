-- Migration 0003: Switch relay_users auth to SHA-224 password hash
--
-- Trojan clients send SHA224(password) as the auth credential.
-- Previously we stored plaintext and compared against it — this never matched.
-- We now store password_hash = SHA224(password) and compare hash-to-hash.
--
-- trojan_password is kept for QR/config reconstruction (GET /users/:id/config,
-- POST /users/:id/rotate).  It is never returned by the API after initial creation.

-- Column is added by initial schema or existing database, just ensure index exists
CREATE INDEX IF NOT EXISTS idx_relay_users_password_hash ON relay_users(password_hash);

-- Existing users have an invalid password_hash ('') and will fail auth.
-- They are considered invalidated by this migration (early-stage, acceptable).
-- New users created after this migration will have a correct SHA-224 hash.
