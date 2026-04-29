import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, Plus, Pause, Play, Trash2, QrCode, X, Wifi, Activity } from 'lucide-react';
import { useRelayUsers } from '../hooks/useRelayUsers.js';
import { useRelay } from '../hooks/useRelay.js';
import type { RelayUserConfig } from '@sepehr/shared-types';
import QrCodeComp from '../components/QrCode.js';

const schema = z.object({ displayName: z.string().min(1).max(64) });
type FormValues = z.infer<typeof schema>;

function NewUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (config: RelayUserConfig, name: string) => void;
}) {
  const { create } = useRelayUsers();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await create.mutateAsync(values);
      if (result) onCreated(result, result.displayName);
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
            Have your family member scan this with V2Box (iPhone/iPad) or v2rayNG (Android).
          </p>
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Remove family member?</h2>
        <p className="text-sm text-slate-400 mb-5">
          This will immediately disconnect <span className="text-slate-200 font-medium">{name}</span> and revoke their current config.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 disabled:opacity-60"
            style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.7)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: '#dc2626' }}
          >
            {pending ? 'Removing…' : 'Yes, remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelative(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}



export default function Users() {
  const { users, isLoading, patch, remove } = useRelayUsers();
  const { relay } = useRelay();
  const [showAdd, setShowAdd] = useState(false);
  const [newConfig, setNewConfig] = useState<{ config: RelayUserConfig; name: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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
              className="p-4"
              style={{
                background: '#111827',
                borderBottom: idx < users.length - 1 ? '1px solid rgba(51,65,85,0.4)' : 'none',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedId((prev) => (prev === user.id ? null : user.id))}
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-slate-100">{user.displayName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {user.isPaused ? 'Paused' : `Last seen ${formatRelative(user.lastSeenAt)}`}
                    </div>
                  </div>
                </button>

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
                    onClick={() => setDeleteTarget({ id: user.id, name: user.displayName })}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/5 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === user.id ? null : user.id))}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
                    title={expandedId === user.id ? 'Collapse details' : 'Expand details'}
                  >
                    <ChevronDown size={16} className={expandedId === user.id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                </div>
              </div>

              {expandedId === user.id && (
                <div className="mt-4 rounded-xl p-4 grid sm:grid-cols-2 gap-3" style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)' }}>
                  <div className="rounded-lg p-3" style={{ background: '#111827' }}>
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Wifi size={13} /> Relay health
                    </div>
                    <div className="text-sm font-medium" style={{ color: relay?.relayStatus === 'active' ? '#22c55e' : '#f59e0b' }}>
                      {relay?.relayStatus === 'active' ? 'Healthy / active' : 'Paused or degraded'}
                    </div>
                  </div>

                  <div className="rounded-lg p-3" style={{ background: '#111827' }}>
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Activity size={13} /> Member connection
                    </div>
                    <div className="text-sm font-medium text-slate-100">
                      {user.isPaused
                        ? 'Paused by admin'
                        : user.isConnected
                          ? 'Connected'
                          : user.lastSeenAt
                            ? `Disconnected — last seen ${formatRelative(user.lastSeenAt)}`
                            : 'Never connected'}
                    </div>
                  </div>



                  <div className="rounded-lg p-3" style={{ background: '#111827' }}>
                    <div className="text-xs text-slate-400 mb-1">Requests used</div>
                    <div className="text-sm font-medium text-slate-100">Not exposed in current Cloudflare API view</div>
                    <div className="text-xs text-slate-500 mt-1">Last activity: {formatRelative(user.lastSeenAt)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <NewUserDialog
          onClose={() => setShowAdd(false)}
          onCreated={(config, name) => {
            handleCreated(config, name);
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

      {deleteTarget && (
        <DeleteUserModal
          name={deleteTarget.name}
          pending={remove.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            void remove.mutateAsync(deleteTarget.id).then(() => setDeleteTarget(null));
          }}
        />
      )}
    </div>
  );
}
