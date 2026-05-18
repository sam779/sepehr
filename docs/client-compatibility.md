# Client Compatibility Matrix

Protocol: **Trojan-over-WSS** at `/trojan`  
Transport: WebSocket, TLS 1.2+, port 443

---

## Tested clients

| Client | Platform | Min version tested | Import method | Status |
|---|---|---|---|---|
| v2rayNG | Android | 1.8.x | QR scan / URI share | ✅ Working |
| Clash Meta (FlClash) | Android | 1.x | Clash YAML import | ✅ Working |
| V2Box | iOS | 2.x | QR scan / URI share | ✅ Working |
| Shadowrocket | iOS | 2.x | QR scan / URI share | ✅ Working |

### Trojan URI format

```
trojan://<password>@<host>:443?type=ws&security=tls&path=%2Ftrojan&host=<host>&sni=<host>#<name>
```

All four clients above correctly parse this format. The `type=ws` parameter selects
WebSocket transport; `security=tls` + `sni` drive TLS SNI. The fragment (`#<name>`) is
used as the display label.

---

## App-specific import notes

### v2rayNG (Android)
- Scan QR directly from the "+" → "Scan QR code" menu.
- Or: paste the `trojan://` URI via "+" → "Import config from clipboard".
- Requires Android 5.0+; works on all modern ROMs.
- **Known caveat**: some v2rayNG 1.7.x builds have a WebSocket path parsing bug.
  Update to 1.8.x or later if the URI imports correctly but traffic doesn't flow.

### Clash Meta / FlClash (Android)
- Import the full Clash YAML from the Config tab.
- The Clash YAML config includes proxy-groups and a MATCH rule so all traffic routes
  through the proxy. Remove or adjust rules for split-tunnel use cases.
- Does not use the `trojan://` URI directly.

### V2Box (iOS)
- "+" → "Import from QR code" → scan, or
- "+" → "Import from clipboard" → paste `trojan://` URI.
- Tested on iOS 16/17.

### Shadowrocket (iOS)
- Tap "+" → paste `trojan://` URI, or scan QR from the main screen.
- The `/connect?c=` share link opens this page; use "Copy URI" then paste in
  Shadowrocket if direct-open doesn't trigger the app.
- Tested on iOS 16/17.

---

## Troubleshooting

### "Handshake rejected" / app shows error immediately after connecting

| Symptom | Likely cause | Fix |
|---|---|---|
| WS upgrade fails silently | Intermediate proxy normalises `Upgrade` header case | Fixed in relay — upgrade detection is now case-insensitive |
| HTTP 400 on `/trojan` | Not a WebSocket request (browser opened the URL directly) | Expected — only WS upgrades are accepted |
| HTTP 429 | Rate limit hit (>10 WS/5 min from same IP) | Wait 5 min, check for connection loops in client |

### "Imported but cannot connect" / times out

1. Verify the relay Worker is deployed and `GET /health` returns `{"status":"ok"}`.
2. Check CF Worker logs for `[tcp]` lines — if TCP connect fails, the destination
   server may be blocked or the IP is in the blocked SSRF list.
3. TCP ready timeout is 10 s. On very slow mobile networks the initial connection
   can exceed this; the user will need to retry.
4. Portal `/relay/check` times out after 1.5 s → fail-open (connection is allowed).
   If you see many `[access] portal check failed (fail-open)` lines in CF logs,
   check portal Worker latency.

### "Connected but no traffic flows"

1. Confirm `type=ws` and `path=/trojan` are present in the imported config.
2. In v2rayNG: open the config details and verify the WS path is `/trojan` (not
   empty or `/`).
3. Check Clash YAML: proxy block must include `network: ws` and `ws-opts.path: /trojan`.
4. UDP is deliberately rejected (WS close 1003). Ensure DNS is routed over TCP or
   the client is in TCP-only mode.

### Share link (`/connect?c=…`) doesn't open the app

- iOS: `trojan://` scheme is registered by V2Box and Shadowrocket. If neither is
  installed, Safari will show "Cannot open page". Use "Copy URI" + paste into app.
- Android Chrome: tapping the "Open in app" button attempts the URI scheme intent.
  If the intent isn't caught, it silently fails — use "Copy URI" fallback.
- Some in-app browsers (WeChat, Instagram) block URI scheme navigation. Open the
  link in the system browser first.

---

## Known deferred risks

- **`.amazonaws.com` domain block**: The relay SSRF ruleset blocks all
  `*.amazonaws.com` hostnames. This prevents proxying traffic to AWS-hosted
  services. The AWS IMDS IP (`169.254.169.254`) is already blocked at the IP level,
  making the domain block redundant for SSRF purposes but a false-positive for
  legitimate destinations. This is tracked as a P3 item for future review.
- **IPv6**: No IPv6 CIDR SSRF checks beyond `::1` and `fe80::/10`. Full
  RFC4193 (`fc00::/7`) blocking is not implemented.
