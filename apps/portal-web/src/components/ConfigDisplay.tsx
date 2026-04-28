import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { RelayUserConfig } from '@sepehr/shared-types';

interface ConfigDisplayProps {
  config: RelayUserConfig;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={() => void copy()}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
      style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ label, value, copyable = true }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>{label}</span>
        {copyable && <CopyButton text={value} />}
      </div>
      <pre
        className="text-xs rounded-lg p-4 overflow-x-auto leading-relaxed select-all"
        style={{ background: '#0a0f1e', color: '#e2e8f0', border: '1px solid rgba(51,65,85,0.5)', fontFamily: 'monospace' }}
      >
        {value}
      </pre>
    </div>
  );
}

export default function ConfigDisplay({ config }: ConfigDisplayProps) {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="space-y-6">
      <CodeBlock label="Trojan URI" value={config.trojanUri} />
      <CodeBlock label="Full Clash Config (YAML)" value={config.clashYaml} />

      {/* Collapsed manual/debug config */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(51,65,85,0.5)' }}>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors"
          style={{ background: '#111827' }}
        >
          <span>Manual config (advanced)</span>
          {showDebug ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showDebug && (
          <div className="p-4 border-t" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
            <CodeBlock
              label="Debug JSON"
              value={JSON.stringify(config.debugJson, null, 2)}
            />
            <p className="text-xs mt-3" style={{ color: '#64748b' }}>
              Use these values only if no app supports QR or YAML import.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
