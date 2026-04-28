# User Guide

This guide explains how to use the Sepehr portal to set up a relay and share access with your family in Iran.

---

## Overview

Sepehr lets you deploy a free relay (a Cloudflare Worker) under your own account, then give your family members a QR code that connects their phone to the open internet in under 60 seconds.

**You need:**
- A Cloudflare account (free)
- A Sepehr portal account

**Your family needs:**
- An iPhone with Shadowrocket, **or**
- An Android phone with v2rayNG

---

## Step 1 — Create an account

1. Go to [sepehr.blackoutobservatory.org/signup](https://sepehr.blackoutobservatory.org/signup)
2. Enter your email and choose a password
3. Check your email for a 6-digit verification code
4. Enter the code to verify your address

---

## Step 2 — Deploy your relay

Your relay is a private Cloudflare Worker running under your account. It costs nothing (Cloudflare free tier: 100,000 requests/day).

1. Go to [Setup](/setup) in the left sidebar
2. Follow the guide to create a Cloudflare API token (takes 2 minutes)
3. Enter your Cloudflare Account ID and the API token
4. Click **Deploy relay**

Deployment takes about 10 seconds. Cloudflare registers a `*.workers.dev` subdomain — no domain purchase required.

> **Your API token is encrypted** (AES-256-GCM) before being stored. It is only used for the initial deployment and is never logged.

---

## Step 3 — Add a family member

1. Go to **Family Members** in the sidebar
2. Click **Add member**
3. Enter a display name (e.g., Maman, Baba, Sepideh)
4. Click **Create & show QR**

A QR code appears immediately. This is a **one-time display** — the code is shown now and cannot be retrieved later. If you close it, you can still view the QR from the user's detail page, but once you **rotate** the credentials the old QR stops working.

You can add up to **5 family members** per relay.

---

## Step 4 — Share the QR code

The easiest way to share is:
- Screenshot the QR code and send it via WhatsApp, Telegram, or Signal
- Or copy the **share URL** from the QR Code tab and send it as a link

The share URL opens a page with the QR code displayed — no account needed to view it.

---

## Step 5 — Family member scans and connects

See the [App Setup Guide](/help) for per-platform instructions.

**iPhone (Shadowrocket):** Tap + → Scan QR Code → toggle ON  
**Android (v2rayNG):** Tap + → Import from QR code → scan → ▶

Connection time: under 10 seconds once the app is installed.

---

## Managing members

### Pause / Resume

If a family member is traveling or needs a temporary pause, click the **pause** button (⏸) next to their name. Their credentials stay intact — resume with ▶.

### Rotate credentials

If you suspect the QR code has been shared beyond your family, rotate the credentials:

1. Open the family member's detail page
2. Scroll to **Rotate connection credentials**
3. Click **Confirm rotate**

A new QR code is generated. The old one stops working immediately. Share the new QR code with your family member.

### Remove a member

Click the trash icon (🗑) next to the member's name and confirm. This disconnects them immediately and cannot be undone.

---

## Understanding the connection

Your relay uses the **Trojan protocol over WebSocket + TLS** — traffic looks identical to normal HTTPS and is extremely hard to detect or block.

- Traffic flows: Phone → relay Worker → open internet
- The relay Worker is your personal Cloudflare Worker, not a shared VPN
- Each family member has a unique password; one person's credentials cannot be used by another
- Cloudflare Workers run on Cloudflare's global network (250+ locations)

---

## Privacy

- The relay logs no traffic. Cloudflare may keep infrastructure logs per their privacy policy.
- Your API token is encrypted in our database and only ever used to manage your Worker.
- We store: your email (hashed in session), relay URL, family member display names, and last-seen timestamps (not IPs).
