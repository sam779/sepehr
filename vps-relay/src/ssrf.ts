/**
 * SSRF protection — mirrors the logic in relay-template.ts so VPS and Worker
 * enforce the same host/port policy consistently.
 */

function parseIPv4ToUint32(host: string): number | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return (((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0);
}

function isBlockedIPv4Uint32(ip: number): boolean {
  if ((ip >>> 24) === 127) return true;                                          // 127.0.0.0/8
  if ((ip >>> 24) === 10) return true;                                           // 10.0.0.0/8
  if ((ip >>> 20) === ((172 << 4) | 1)) return true;                            // 172.16.0.0/12
  if ((ip >>> 16) === ((192 << 8) | 168)) return true;                          // 192.168.0.0/16
  if ((ip >>> 16) === ((169 << 8) | 254)) return true;                          // 169.254.0.0/16
  if (ip === 0) return true;                                                     // 0.0.0.0
  if (ip === (((168 << 24) | (63 << 16) | (129 << 8) | 16) >>> 0)) return true; // Azure IMDS
  return false;
}

export function isBlockedHost(host: string): boolean {
  const lower = host.toLowerCase();

  const ipv4 = parseIPv4ToUint32(host);
  if (ipv4 !== null) return isBlockedIPv4Uint32(ipv4);

  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower === 'localhost') return true;
  if (lower.endsWith('.local') || lower === 'local') return true;
  if (lower.endsWith('.internal') || lower === 'internal') return true;
  if (lower.startsWith('metadata.')) return true;
  if (lower.endsWith('.amazonaws.com')) return true;

  // All-numeric dot-separated labels → disguised IPv4
  const labels = lower.split('.');
  if (labels.every((l) => /^\d+$/.test(l))) {
    const ip2 = parseIPv4ToUint32(lower);
    return ip2 !== null ? isBlockedIPv4Uint32(ip2) : true;
  }

  return false;
}

export function isBlockedPort(port: number): boolean {
  // Block SMTP, common internal service ports
  const blocked = new Set([25, 465, 587, 2525, 3389, 5432, 3306, 6379, 27017]);
  return blocked.has(port);
}

export function validateHostname(domain: string): boolean {
  if (!/^[a-zA-Z0-9._-]+$/.test(domain)) return false;
  if (domain.length > 253) return false;
  const labels = domain.split('.');
  if (labels.some((l) => l.length === 0 || l.length > 63)) return false;
  if (labels.every((l) => /^\d+$/.test(l))) return false; // All-numeric → treat as IP
  return true;
}
