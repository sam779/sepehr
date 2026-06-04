-- Migration 0004: Add is_connected to relay_users
-- Tracks live WebSocket connection state; set by relay on connect/disconnect events.

-- Column is present in the current initial schema.
SELECT 1;
