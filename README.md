# Sepehr

Sepehr is a Cloudflare-native relay deployment platform for helping families in Iran access the open internet.

## Production Architecture (Final)

- Runtime: Cloudflare Workers only
- Data: Cloudflare D1
- Frontend hosting: Cloudflare Pages
- Deployment automation: Cloudflare Workers API
- Relay transport: Trojan-over-WebSocket+TLS with `cloudflare:sockets`

Hard constraints:
- No VPS architecture
- No external relay servers
- No hybrid/multi-hop tunneling layer
- No Node.js backend outside Cloudflare Workers

## Core User Flow

1. User A signs up and verifies email
2. User A logs in and opens Setup
3. User A creates a Cloudflare API token (Workers Scripts: Edit, Account: Read)
4. User A pastes Account ID + API token
5. Sepehr validates credentials and deploys a relay Worker into User A's Cloudflare account
6. User A creates up to 5 User B profiles
7. Sepehr generates Trojan URI, Clash YAML, and QR code for User B

## Security Model

- Cloudflare API tokens are AES-256-GCM encrypted at rest in D1 (`ENCRYPTION_KEY`)
- Relay access uses hash-to-hash validation (`SHA224(password)`)
- Relay-to-portal auth uses a per-relay secret hash (`SHA-256`)
- Each relay is isolated per user-owned Cloudflare account

## Dev Setup

- See [docs/operator-setup.md](docs/operator-setup.md)
- Protocol details: [docs/relay-spec.md](docs/relay-spec.md)
- End-user instructions: [docs/user-guide.md](docs/user-guide.md)
