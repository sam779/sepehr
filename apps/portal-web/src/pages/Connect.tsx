import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wifi, Copy, ExternalLink, AlertCircle, Check, ChevronDown } from 'lucide-react';

/**
 * Reverse of encodeQrData() in @sepehr/config-schema.
 * base64url → binary string (trojan:// URI is ASCII-safe so charCode masking is lossless).
 */
function decodeQrData(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
  return atob(padded);
}

export default function Connect() {
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [showUri, setShowUri] = useState(false);

  const encoded = searchParams.get('c') ?? '';
  let trojanUri: string | null = null;
  let decodeError = false;

  if (encoded) {
    try {
      const decoded = decodeQrData(encoded);
      if (decoded.startsWith('trojan://')) {
        trojanUri = decoded;
      } else {
        decodeError = true;
      }
    } catch {
      decodeError = true;
    }
  }

  const isInvalid = !encoded || decodeError || !trojanUri;

  const handleCopy = async () => {
    if (!trojanUri) return;
    try {
      await navigator.clipboard.writeText(trojanUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (some in-app browsers) — show raw URI for manual copy
      setShowUri(true);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: '#0a0f1e', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: '#06b6d4' }}
        >
          <Wifi size={20} className="text-white" />
        </div>
        <span className="font-semibold text-slate-100 text-xl">Sepehr</span>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}
      >
        {isInvalid ? (
          /* ── Error state ─────────────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)' }}
            >
              <AlertCircle size={24} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 mb-2">Invalid share link</h1>
              <p className="text-sm text-slate-400">
                This link is missing or contains invalid connection data. Ask the relay operator
                to share a new link from the portal.
              </p>
            </div>
          </div>
        ) : (
          /* ── Success state ───────────────────────────────────────────────── */
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h1 className="text-lg font-semibold text-slate-100 mb-1">
                Open connection in app
              </h1>
              <p className="text-sm text-slate-400">
                Tap below to import this configuration into your proxy app.
              </p>
            </div>

            {/* Primary: try to hand off to a registered trojan:// handler */}
            <a
              href={trojanUri!}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-base"
              style={{ background: '#06b6d4' }}
            >
              <ExternalLink size={18} />
              Open in app
            </a>

            {/* Secondary: clipboard copy */}
            <button
              onClick={() => void handleCopy()}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-sm transition-colors"
              style={{
                background: 'rgba(6,182,212,0.1)',
                color: '#06b6d4',
                border: '1px solid rgba(6,182,212,0.3)',
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy URI'}
            </button>

            {/* Tertiary: expand raw URI for manual paste (clipboard fallback) */}
            <div>
              <button
                onClick={() => setShowUri((v) => !v)}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: '#64748b' }}
              >
                <ChevronDown
                  size={14}
                  style={{
                    transform: showUri ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
                {showUri ? 'Hide' : 'Show'} raw URI
              </button>
              {showUri && (
                <textarea
                  readOnly
                  value={trojanUri!}
                  rows={4}
                  className="mt-2 w-full text-xs p-2 rounded-lg resize-none"
                  style={{
                    background: '#0d1527',
                    border: '1px solid rgba(51,65,85,0.4)',
                    color: '#94a3b8',
                    fontFamily: 'monospace',
                  }}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              )}
            </div>

            {/* App hints */}
            <div
              className="rounded-xl p-4"
              style={{ background: '#0d1527', border: '1px solid rgba(51,65,85,0.4)' }}
            >
              <p
                className="mb-2 font-medium text-xs uppercase tracking-wide"
                style={{ color: '#64748b' }}
              >
                Supported apps
              </p>
              <ul className="text-slate-300 space-y-1 text-sm">
                <li>
                  iOS — <strong>V2Box</strong> or <strong>Shadowrocket</strong>
                </li>
                <li>
                  Android — <strong>v2rayNG</strong> or <strong>Clash Meta</strong>
                </li>
              </ul>
              <p className="text-xs mt-3" style={{ color: '#64748b' }}>
                If the app doesn't open automatically, use "Copy URI" and paste it in
                your app's import / add-server screen.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
