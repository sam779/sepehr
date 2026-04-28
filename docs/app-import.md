# App Import Guide

Detailed import instructions for each supported app.

---

## Shadowrocket (iPhone / iPad)

**Download:** [App Store — $2.99](https://apps.apple.com/app/shadowrocket/id932747118)

### Import via QR code (recommended)

1. Open Shadowrocket
2. Tap **+** in the top-right corner
3. Tap **Scan QR Code**
4. Point your camera at the QR code shown in Sepehr
5. Shadowrocket imports the proxy automatically
6. Tap the imported entry to select it
7. Toggle the top switch to **ON**

### Import via URL

1. In Sepehr, go to your family member's **Config** tab
2. Copy the **Trojan URI** (starts with `trojan://`)
3. In Shadowrocket, tap **+** → **Type: Trojan** — or just paste the URI:
   - Open Safari, paste the URI in the address bar and visit it
   - Shadowrocket will ask to import it
4. Toggle ON

### Troubleshooting Shadowrocket

- **"Unable to connect"** — confirm the relay is deployed and the user is not paused
- **Slow speeds** — try different Cloudflare edge locations by toggling off/on
- **Battery drain** — this is normal for VPN apps; use Low Data Mode in iOS settings

---

## v2rayNG (Android)

**Download:** [Google Play](https://play.google.com/store/apps/details?id=com.v2ray.ang) | [GitHub Releases](https://github.com/2dust/v2rayNG/releases/latest)

### Import via QR code (recommended)

1. Open v2rayNG
2. Tap **+** (top-right)
3. Tap **Import config from QR code**
4. Scan the QR code shown in Sepehr
5. The entry appears in the list
6. Tap the entry to select it (checkmark appears)
7. Tap the **▶** button at the bottom to connect

### Import via URI

1. Copy the Trojan URI from Sepehr (Config tab)
2. In v2rayNG: tap **+** → **Import config from clipboard**
3. Connect via ▶

### Troubleshooting v2rayNG

- **Permission denied** — grant VPN permission when Android prompts
- **Config not imported** — make sure you copied the full `trojan://` URI including the fragment after `#`
- **Connection drops** — enable **Keep VPN Alive** in v2rayNG settings

---

## Clash Verge Rev (Windows / macOS / Linux)

**Download:** [GitHub Releases](https://github.com/clash-verge-rev/clash-verge-rev/releases/latest)

### Import via YAML file

1. In Sepehr, open your family member's **Config** tab
2. Click **Copy** next to **Full Clash Config (YAML)**
3. Paste into a text editor and save as `sepehr.yaml`
4. Open Clash Verge
5. Go to **Profiles** tab
6. Drag the `.yaml` file onto the window, or click **Import File**
7. Click the imported profile to activate it (it gets a border)
8. Switch to the **Proxies** tab, select the `Sepehr` proxy group
9. Go to **Settings** → enable **System Proxy**

### Keeping the config updated

After rotating credentials in Sepehr, repeat the above steps with the new YAML. Old configs stop working immediately on rotate.

---

## Clash Meta for Android

**Download:** [GitHub Releases](https://github.com/MetaCubeX/ClashMetaForAndroid/releases/latest)

### Import via YAML

1. Copy the Full Clash Config YAML from Sepehr (Config tab)
2. Open Clash Meta for Android
3. Go to **Profiles** → tap **+** (or New Profile)
4. Choose **File** and paste the YAML
5. Save and tap the profile to activate
6. Tap the cloud/connect button

### Alternative: import from URL

If you host the YAML file at a URL (e.g., on GitHub Gist):

1. In Clash Meta: Profiles → New → URL
2. Paste the raw URL to the YAML
3. Tap **Download**

---

## Manual configuration (any Trojan-compatible app)

The relay endpoint supports standard Trojan-over-WebSocket+TLS. Use these values:

| Setting | Value |
|---------|-------|
| Protocol | Trojan |
| Server | `<worker-subdomain>.workers.dev` |
| Port | `443` |
| Password | (from debug JSON in Config tab) |
| Transport | WebSocket |
| WS Path | `/trojan` |
| TLS | enabled |
| SNI | `<worker-subdomain>.workers.dev` |
| Skip cert verify | false |

The debug JSON (collapsed in the Config tab) shows all values formatted for manual entry.
