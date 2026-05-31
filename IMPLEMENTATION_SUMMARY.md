# Connection Logs & Country Tracking Implementation

## Summary
Added connection logging and relay exit location tracking to the dashboard. Family members now show:
1. **Tunnel location (country)** - where the connection is exiting through Cloudflare
2. **Logs tab** - last 24 hours of connection events, errors, and status changes

## Changes Made

### 1. Database Schema Updates Required
You need to add these columns to your D1 database:

```sql
-- Add to relay_users table
ALTER TABLE relay_users ADD COLUMN connection_country TEXT;

-- Create connection_logs table
CREATE TABLE connection_logs (
  id TEXT PRIMARY KEY,
  relay_user_id TEXT NOT NULL,
  event TEXT NOT NULL,
  country TEXT,
  error_message TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (relay_user_id) REFERENCES relay_users(id)
);

-- Add index for faster log queries
CREATE INDEX idx_connection_logs_user_timestamp 
  ON connection_logs(relay_user_id, timestamp DESC);
```

### 2. Backend Changes (Portal Worker)
**File: `apps/portal-worker/src/routes/relay.ts`**

Added three new features:
- **Updated `/relay/users` endpoint** - now returns `connection_country` field
- **New `/relay/log` endpoint** - accepts connection events from relay Worker
  - Auth: Bearer token (relay secret)
  - Logs: connect, disconnect, error, auth_failed events
  - Updates `connection_country` on connect events
  
- **New `/relay/users/:id/logs` endpoint** - returns logs for last 24 hours
  - Auth: Session required (user only sees their own logs)
  - Returns up to 100 events in reverse chronological order

### 3. Frontend Changes

#### Type Definitions
**File: `packages/shared-types/src/index.ts`**
- Added `ConnectionLog` interface
- Added `RelayLogEventRequest` interface
- Extended `RelayUser` with `connectionCountry` field

#### API Client
**File: `apps/portal-web/src/lib/api-client.ts`**
- Added `api.users.logs(id)` method to fetch connection logs

#### Hooks
**File: `apps/portal-web/src/hooks/useConnectionLogs.ts` (NEW)**
- New hook for fetching and caching logs
- 30-second stale time, auto-refetch

#### UI Components
**File: `apps/portal-web/src/pages/Users.tsx`**
- Added "Details" and "Logs" tabs in family member details
- **Details tab** shows:
  - Relay health status
  - Member connection status
  - **Tunnel location (country)** - NEW
  - Request usage
- **Logs tab** shows:
  - Color-coded events (connect=green, disconnect=yellow, error/auth_failed=red)
  - Country badge when available
  - Error messages (if any)
  - Timestamp for each event
  - Scrollable list limited to 100 events

## What the Relay Worker Needs to Do

The relay Worker needs to send connection events to the portal. Add calls to:

```
POST https://portal-api.blackoutobservatory.org/api/relay/log
Authorization: Bearer <relay_secret>

Body:
{
  "relay_id": "relay-uuid",
  "user_id": "user-uuid",
  "event": "connect|disconnect|error|auth_failed",
  "country": "US",  // Cloudflare worker location (optional)
  "error_message": "..." // Only for error/auth_failed events
}
```

### Getting Country in Cloudflare Worker

In your relay Worker, detect the country using:

```javascript
// From incoming request headers
const country = request.headers.get('cf-ipcountry') || 'Unknown';

// Or from worker context (if using Cloudflare runtime)
const country = env.CF_WORKER_COUNTRY || 'Unknown';

// Or use the worker's own location (Cloudflare colo)
const country = 'US'; // Or lookup colo code to country mapping
```

## Testing

1. **Deploy backend:**
   ```bash
   npm run deploy -w apps/portal-worker
   ```

2. **Deploy frontend:**
   ```bash
   npm run deploy -w apps/portal-web
   ```

3. **Create database schema** (if not using migrations):
   - Run the SQL ALTER/CREATE statements above

4. **Test the flow:**
   - Add a family member
   - Have them connect via V2Box/v2rayNG
   - Relay Worker sends `/log` event with `event: "connect"` and country
   - Portal stores the log and updates `connection_country`
   - Check Family Members page → expand member → see country and logs

## Notes

- Logs are filtered to last 24 hours per design requirement
- Country field is optional; logs work without it
- Events are stored as they happen; no polling needed
- Logs can be extended later (e.g., bandwidth usage, error counts)
- The relay secret is used for authentication on the `/log` endpoint
