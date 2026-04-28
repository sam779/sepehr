import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, HelpCircle, LogOut, Wifi } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Family Members' },
  { to: '/help', icon: HelpCircle, label: 'Help' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0f1e' }}>
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r" style={{ background: '#111827', borderColor: 'rgba(51,65,85,0.5)' }}>
        <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#06b6d4' }}>
            <Wifi size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-100">Sepehr</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: 'rgba(6,182,212,0.15)', color: '#06b6d4' } : {}
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 space-y-1 border-t pt-4" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
          <button
            onClick={() => navigate('/setup')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-white/5 w-full transition-colors"
          >
            <Settings size={18} />
            Relay Setup
          </button>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/5 w-full transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>

        {user && (
          <div className="px-6 py-3 border-t text-xs text-slate-500 truncate" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
            {user.email}
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
