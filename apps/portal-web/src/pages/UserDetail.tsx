import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, RotateCw, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api-client.js';
import QrCodeComp from '../components/QrCode.js';
import ConfigDisplay from '../components/ConfigDisplay.js';
import AppGuide from '../components/AppGuide.js';
import type { RelayUserConfig } from '@sepehr/shared-types';

const TABS = ['QR Code', 'Config', 'Apps'] as const;
type Tab = (typeof TABS)[number];

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('QR Code');
  const [config, setConfig] = useState<RelayUserConfig | null>(null);
  const [rotateConfirm, setRotateConfirm] = useState(false);

  const configQuery = useQuery({
    queryKey: ['user-config', id],
    queryFn: async () => {
      const res = await api.users.config(id!);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
  });

  const rotateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.users.rotate(id!);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      setConfig(data);
      setRotateConfirm(false);
    },
  });

  const displayConfig = config ?? configQuery.data ?? null;

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  if (configQuery.isError || !displayConfig) {
    return (
      <div className="p-8">
        <Link to="/users" className="flex items-center gap-2 text-slate-400 hover:text-slate-100 mb-6 text-sm">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="text-red-400">Failed to load user config.</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link to="/users" className="flex items-center gap-2 text-slate-400 hover:text-slate-100 mb-6 text-sm">
        <ArrowLeft size={16} /> Family Members
      </Link>

      {/* Rotate password warning */}
      {config && (
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: '#fcd34d' }}>New config generated</p>
            <p className="text-xs mt-0.5" style={{ color: '#fbbf24' }}>
              The previous QR code / URI is now invalid. Share the new one below.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: '#111827' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={
              activeTab === tab
                ? { background: '#1e293b', color: '#f1f5f9' }
                : { color: '#94a3b8' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
        {activeTab === 'QR Code' && (
          <div className="flex flex-col items-center gap-6">
            <QrCodeComp data={displayConfig.trojanUri} label="sepehr-connection" />
            <p className="text-sm text-center text-slate-400">
              Scan with <strong className="text-slate-200">V2Box</strong> (iPhone / iPad) or{' '}
              <strong className="text-slate-200">v2rayNG</strong> (Android).
              <br />
              <span className="text-xs mt-1 block">Or share the link: </span>
              <a
                href={displayConfig.shareUrl}
                className="text-xs break-all"
                style={{ color: '#06b6d4' }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {displayConfig.shareUrl}
              </a>
            </p>
          </div>
        )}

        {activeTab === 'Config' && <ConfigDisplay config={displayConfig} />}
        {activeTab === 'Apps' && <AppGuide />}
      </div>

      {/* Rotate password */}
      <div className="mt-6 rounded-2xl p-5" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
        <h3 className="font-medium text-slate-100 mb-1">Rotate connection credentials</h3>
        <p className="text-sm text-slate-400 mb-4">
          Generates a new password. The current QR code will stop working immediately.
        </p>

        {!rotateConfirm ? (
          <button
            onClick={() => setRotateConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <RotateCw size={15} />
            Rotate credentials
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => void rotateMutation.mutateAsync()}
              disabled={rotateMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: '#b45309' }}
            >
              {rotateMutation.isPending ? 'Rotating…' : 'Confirm rotate'}
            </button>
            <button
              onClick={() => setRotateConfirm(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
