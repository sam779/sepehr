-- Migration 0004: Add is_connected to relay_users
-- Tracks live WebSocket connection state; set by relay on connect/disconnect events.

ALTER TABLE relay_users ADD COLUMN is_connected INTEGER NOT NULL DEFAULT 0;
