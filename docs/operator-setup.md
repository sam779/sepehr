# Operator Setup Guide

This guide walks you through deploying Sepehr from scratch: creating a Cloudflare account, deploying the portal Worker, and going live.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 or later |
| npm | 10 or later |
| Git | any recent |
| Wrangler CLI | installed via `npm install` below |

---

## 1. Clone and install

```bash
git clone <repo>
cd sepehr
npm install
```

---

## 2. Create Cloudflare account

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Note your **Account ID** (shown in the Workers overview URL: `dash.cloudflare.com/<ACCOUNT_ID>/workers`)
3. Add the domain `blackoutobservatory.org` to Cloudflare (or replace with your own domain in all config files)

---

## 3. Create D1 database

```bash
npx wrangler d1 create sepehr-portal
```

Copy the `database_id` from the output and set it in `infra/wrangler/portal.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "sepehr-portal"
database_id = "<paste here>"
```

---

## 4. Run migrations

```bash
# Local dev
npx wrangler d1 execute sepehr-portal --local --file database/migrations/0001_initial.sql
npx wrangler d1 execute sepehr-portal --local --file database/migrations/0002_rate_limits.sql

# Production
npx wrangler d1 execute sepehr-portal --file database/migrations/0001_initial.sql
npx wrangler d1 execute sepehr-portal --file database/migrations/0002_rate_limits.sql
```

---

## 5. Set Worker secrets

Generate an encryption key (32 random bytes in base64url):

```bash
node -e "const b=crypto.getRandomValues(new Uint8Array(32));console.log(Buffer.from(b).toString('base64url'))"
```

Set secrets:

```bash
npx wrangler secret put ENCRYPTION_KEY --config infra/wrangler/portal.toml
npx wrangler secret put RESEND_API_KEY --config infra/wrangler/portal.toml
npx wrangler secret put SESSION_SECRET --config infra/wrangler/portal.toml
```

`SESSION_SECRET` can be any random 32-byte base64url string.

---

## 6. Configure Resend

1. Sign up at [resend.com](https://resend.com) (free tier: 100 emails/day)
2. Add and verify your sending domain (e.g., `sepehr.blackoutobservatory.org`)
3. Create an API key and save it — this is `RESEND_API_KEY`
4. The FROM address in `apps/portal-worker/src/lib/email.ts` is `noreply@sepehr.blackoutobservatory.org` — update if using a different domain

---

## 7. Deploy portal Worker

```bash
cd infra/wrangler
npx wrangler deploy portal.toml
```

Set a custom domain (`portal-api.blackoutobservatory.org`) in the Cloudflare dashboard:
Workers & Pages → sepehr-portal → Settings → Triggers → Custom Domains → Add

---

## 8. Deploy portal Web (Cloudflare Pages)

```bash
cd apps/portal-web
npm run build
```

In the Cloudflare dashboard:
- Workers & Pages → Create application → Pages → Upload files
- Or connect your Git repo and set:
  - Build command: `npm run build -w apps/portal-web`
  - Build output: `apps/portal-web/dist`
  - Environment variable: `VITE_API_URL = https://portal-api.blackoutobservatory.org`

Add a custom domain `sepehr.blackoutobservatory.org` to the Pages project.

---

## 9. DNS records

In the Cloudflare DNS dashboard for your domain:

| Type | Name | Target |
|------|------|--------|
| CNAME | `portal-api` | `<worker>.workers.dev` |
| CNAME | `sepehr` | `<pages-project>.pages.dev` |

(Both proxied through Cloudflare.)

---

## 10. Local development

Terminal 1 — Portal Worker:
```bash
npx wrangler dev --config infra/wrangler/portal.toml
```

Terminal 2 — Portal Web (Vite):
```bash
npm run dev -w apps/portal-web
```

The Vite dev proxy forwards `/api/*` to `http://localhost:8787`.

---

## Environment notes

- The portal Worker does not auto-create admin accounts. Sign up via the web UI.
- Each operator (you) gets one relay per account.
- Relay Workers are deployed to your users' Cloudflare accounts, not yours.
- The `ENCRYPTION_KEY` is used to AES-256-GCM encrypt user CF API tokens at rest in D1.
