/**
 * @sepehr/config-schema
 *
 * Config generation for relay connections.
 * Produces: Trojan URI, Clash YAML, debug JSON, QR data, share URL.
 */

function getPortalOrigin(): string {
  if (typeof window !== 'undefined') {
    // Browser environment: use current origin
    return window.location.origin;
  }
  // Server environment: use production domain
  return 'https://sepehr.blackoutobservatory.org';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrojanParams {
  /** base64url(trojan_secret) — the relay user's password */
  password: string;
  /** worker hostname, e.g. sepehr-abc.acct.workers.dev */
  host: string;
  /** Human-readable label shown in proxy apps */
  displayName: string;
}

// ─── Trojan URI ──────────────────────────────────────────────────────────────

/**
 * Build the primary connection URI.
 * Natively importable via QR scan in Shadowrocket, v2rayNG, Clash Meta, Clash Verge.
 *
 * Format:
 *   trojan://<password>@<host>:443?type=ws&security=tls&path=%2Ftrojan&host=<host>&sni=<host>#<name>
 */
export function buildTrojanUri({ password, host, displayName }: TrojanParams): string {
  const name = encodeURIComponent(displayName);
  return (
    `trojan://${password}@${host}:443` +
    `?type=ws&security=tls&path=%2Ftrojan&host=${host}&sni=${host}#${name}`
  );
}

// ─── Clash YAML ──────────────────────────────────────────────────────────────

interface ClashParams {
  password: string;
  host: string;
  name: string;
}

/** Single proxy block suitable for pasting inside a larger Clash config. */
export function buildClashProxyBlock({ password, host, name }: ClashParams): string {
  return [
    `- name: "${name}"`,
    `  type: trojan`,
    `  server: ${host}`,
    `  port: 443`,
    `  password: ${password}`,
    `  network: ws`,
    `  ws-opts:`,
    `    path: /trojan`,
    `    headers:`,
    `      Host: ${host}`,
    `  sni: ${host}`,
    `  skip-cert-verify: false`,
    `  udp: false`,
  ].join('\n');
}

/**
 * Complete Clash / Clash Meta YAML config that actually routes traffic.
 * Without proxy-groups + rules the proxy is imported but nothing flows through it.
 */
export function buildFullClashConfig({ password, host, name }: ClashParams): string {
  const proxy = buildClashProxyBlock({ password, host, name });
  return [
    `mixed-port: 7890`,
    `allow-lan: false`,
    `mode: rule`,
    `log-level: warning`,
    ``,
    `proxies:`,
    `  ${proxy.replace(/\n/g, '\n  ')}`,
    ``,
    `proxy-groups:`,
    `  - name: "Sepehr"`,
    `    type: select`,
    `    proxies:`,
    `      - "${name}"`,
    ``,
    `rules:`,
    `  - MATCH,Sepehr`,
  ].join('\n');
}

// ─── Debug JSON ──────────────────────────────────────────────────────────────

/**
 * Fallback manual config displayed in a collapsed section on the Config tab.
 * Never used for QR encoding. Intended for power users doing manual setup.
 */
export function buildDebugJson({
  password,
  host,
}: {
  password: string;
  host: string;
}): Record<string, unknown> {
  return {
    server: host,
    port: 443,
    password,
    network: 'ws',
    path: '/trojan',
    tls: true,
  };
}

// ─── QR / share helpers ──────────────────────────────────────────────────────

/** base64url-encode a trojan:// URI for client-side QR generation. */
export function encodeQrData(trojanUri: string): string {
  let binary = '';
  for (let i = 0; i < trojanUri.length; i++) {
    binary += String.fromCharCode(trojanUri.charCodeAt(i) & 0xff);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Deep link that opens the trojan URI in supported apps via the portal landing page. */
export function buildShareUrl(trojanUri: string): string {
  return `${getPortalOrigin()}/connect?c=${encodeQrData(trojanUri)}`;
}
