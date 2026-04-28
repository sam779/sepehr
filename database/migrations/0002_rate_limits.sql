-- Migration 0002: Rate limits table
-- Used by the portal API to enforce per-IP rate limits on auth endpoints.

CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL
);
