import { Link } from 'react-router-dom';
import { useRelay } from '../hooks/useRelay.js';
import { useRelayUsers } from '../hooks/useRelayUsers.js';
import { Wifi, WifiOff, Plus, Clock, Users, ArrowRight } from 'lucide-react';

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const { relay, isLoading: relayLoading } = useRelay();
  const { users, isLoading: usersLoading } = useRelayUsers();

  if (relayLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 mt-1">Overview of your relay and connected family members.</p>
      </div>

      {/* Relay status */}
      {!relay ? (
        <div className="rounded-2xl p-8 text-center mb-8" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
          <WifiOff size={40} className="mx-auto mb-4" style={{ color: '#475569' }} />
          <h2 className="text-lg font-semibold text-slate-100 mb-2">No relay deployed yet</h2>
          <p className="text-slate-400 text-sm mb-6">
            Deploy a relay to start giving your family access to the open internet.
          </p>
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#06b6d4' }}
          >
            Deploy your relay <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl p-6 mb-8" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: relay.relayStatus === 'active' ? '#0d9488' : '#f59e0b' }} />
                <span className="text-sm font-medium" style={{ color: relay.relayStatus === 'active' ? '#0d9488' : '#f59e0b' }}>
                  {relay.relayStatus === 'active' ? 'Active' : 'Paused'}
                </span>
              </div>
              <h2 className="font-semibold text-slate-100 text-lg">{relay.workerName}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{relay.workerUrl}</p>
            </div>
            <Wifi size={24} style={{ color: '#06b6d4' }} />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="rounded-xl p-4" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} style={{ color: '#06b6d4' }} />
                <span className="text-xs text-slate-400">Family members</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">{relay.userCount} / 5</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} style={{ color: '#06b6d4' }} />
                <span className="text-xs text-slate-400">Deployed</span>
              </div>
              <div className="text-sm font-medium text-slate-100">
                {new Date(relay.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users list */}
      {relay && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-100">Family Members</h2>
            <Link
              to="/users"
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: '#06b6d4' }}
            >
              <Plus size={16} />
              Add member
            </Link>
          </div>

          {usersLoading ? (
            <div className="text-slate-400 text-sm">Loading…</div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
              <p className="text-slate-400 text-sm">No family members yet.</p>
              <Link
                to="/users"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}
              >
                <Plus size={15} /> Add first member
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <Link
                  key={user.id}
                  to={`/users/${user.id}`}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors"
                  style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-slate-100">{user.displayName}</div>
                      <div className="text-xs text-slate-400">
                        {user.isPaused ? '⏸ Paused' : `Last seen ${formatRelative(user.lastSeenAt)}`}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-600" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
