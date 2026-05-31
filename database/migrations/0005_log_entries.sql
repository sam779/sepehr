-- Add connection_country column to relay_users if it doesn't exist
-- (check by trying to add and ignore error if column exists)
ALTER TABLE relay_users ADD COLUMN connection_country TEXT;

-- Create connection_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS connection_logs (
  id TEXT PRIMARY KEY,
  relay_user_id TEXT NOT NULL,
  event TEXT NOT NULL,
  country TEXT,
  error_message TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (relay_user_id) REFERENCES relay_users(id)
);

-- Add index for faster log queries
CREATE INDEX IF NOT EXISTS idx_connection_logs_user_timestamp
  ON connection_logs(relay_user_id, timestamp DESC);