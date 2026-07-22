import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  MdDashboard, MdRadar, MdWarning, MdBuild, MdBarChart, MdSettings, MdLogout, MdTrain,
} from 'react-icons/md';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV = [
  { to: '/dashboard', icon: MdDashboard, label: 'Dashboard' },
  { to: '/monitoring', icon: MdRadar, label: 'Live Monitoring' },
  { to: '/alerts', icon: MdWarning, label: 'Alerts & Faults' },
  { to: '/maintenance', icon: MdBuild, label: 'Maintenance' },
  { to: '/reports', icon: MdBarChart, label: 'Reports & Analytics' },
  { to: '/settings', icon: MdSettings, label: 'Settings' },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`
        fixed top-0 left-0 h-full z-40 w-64 bg-[#0F172A] border-r border-slate-800/80
        flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/80">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <MdTrain className="text-white text-xl" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">RailGuard AI</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Fault Detection</p>
          </div>
        </div>

        <div className="px-3 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/40">
            <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate capitalize">{user?.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`text-lg flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800/80">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full transition-all duration-150"
          >
            <MdLogout className="text-lg" />
            Logout
          </button>
          <p className="text-[10px] text-slate-600 text-center mt-3">v2.1.4 · RailGuard AI © 2026</p>
        </div>
      </aside>
    </>
  );
}
