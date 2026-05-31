-- Migration 0004: Add is_connected to relay_users
-- Tracks live WebSocket connection state; set by relay on connect/disconnect events.

-- Column already exists in schema or current database, this is a no-op
-- (included for completeness and migration history)
SELECT 1;
