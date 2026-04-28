import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pause, Play, Trash2, QrCode, X } from 'lucide-react';
import { useRelayUsers } from '../hooks/useRelayUsers.js';
import type { RelayUserConfig } from '@sepehr/shared-types';
import QrCodeComp from '../components/QrCode.js';

const schema = z.object({ displayName: z.string().min(1).max(64) });
type FormValues = z.infer<typeof schema>;

function NewUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (config: RelayUserConfig) => void;
}) {
  const { create } = useRelayUsers();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await create.mutateAsync(values);
      if (result) onCreated(result);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-100">Add Family Member</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
            <input
              type="text"
              placeholder="e.g. Maman, Baba, Dariush…"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.8)', color: '#f1f5f9' }}
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="mt-1 text-xs text-red-400">{errors.displayName.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-lg px-3 py-2 text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-60"
            style={{ background: '#06b6d4' }}
          >
            {isSubmitting ? 'Creating…' : 'Create & show QR'}
          </button>
        </form>
      </div>
    </div>
  );
}

function QrModal({ config, name, onClose }: { config: RelayUserConfig; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-100">QR Code — {name}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col items-center">
          <QrCodeComp data={config.trojanUri} label={name} />
          <p className="mt-4 text-xs text-center text-slate-400">
            Have your family member scan this with Shadowrocket (iOS) or v2rayNG (Android).
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const { users, isLoading, patch, remove } = useRelayUsers();
  const [showAdd, setShowAdd] = useState(false);
  const [newConfig, setNewConfig] = useState<{ config: RelayUserConfig; name: string } | null>(null);

  const handleCreated = (config: RelayUserConfig, name: string) => {
    setShowAdd(false);
    setNewConfig({ config, name });
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Family Members</h1>
          <p className="text-slate-400 mt-1">Up to 5 members per relay.</p>
        </div>
        {users.length < 5 && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#06b6d4' }}
          >
            <Plus size={16} />
            Add member
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-slate-400">Loading…</div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
          <p className="text-slate-400 mb-4">No family members yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#06b6d4' }}
          >
            <Plus size={16} className="inline mr-2" />
            Add first member
          </button>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(51,65,85,0.5)' }}>
          {users.map((user, idx) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4"
              style={{
                background: '#111827',
                borderBottom: idx < users.length - 1 ? '1px solid rgba(51,65,85,0.4)' : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <Link
                    to={`/users/${user.id}`}
                    className="font-medium text-slate-100 hover:text-cyan-400 transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {user.isPaused ? '⏸ Paused' : user.lastSeenAt ? `Last seen ${new Date(user.lastSeenAt).toLocaleDateString()}` : 'Never connected'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Link
                  to={`/users/${user.id}`}
                  className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
                  title="View QR & config"
                >
                  <QrCode size={16} />
                </Link>
                <button
                  onClick={() => void patch.mutateAsync({ id: user.id, body: { isPaused: !user.isPaused } })}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
                  title={user.isPaused ? 'Resume' : 'Pause'}
                >
                  {user.isPaused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${user.displayName}? This will disconnect them immediately.`)) {
                      void remove.mutateAsync(user.id);
                    }
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/5 transition-colors"
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <NewUserDialog
          onClose={() => setShowAdd(false)}
          onCreated={(config) => {
            // find the name from users list after creation
            handleCreated(config, 'New Member');
          }}
        />
      )}

      {newConfig && (
        <QrModal
          config={newConfig.config}
          name={newConfig.name}
          onClose={() => setNewConfig(null)}
        />
      )}
    </div>
  );
}
