import { useState, useEffect } from 'react';
import { MdMenu, MdNotifications, MdSearch, MdCircle } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_NOTIFICATIONS } from '../data/mockData';
import type { Notification } from '../types';

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const typeColor: Record<string, string> = {
    critical: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
    success: 'text-green-500',
  };

  const roleLabel: Record<string, string> = {
    railway_administrator: 'Railway Administrator',
    station_incharge: 'Station Incharge',
    maintenance_team: 'Maintenance Team',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 gap-3 sticky top-0 z-20 shadow-sm">
      <button
        onClick={onMenuToggle}
        className="lg:hidden w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
      >
        <MdMenu className="text-xl" />
      </button>

      <div className="flex-1 hidden sm:flex">
        <div className="relative max-w-xs w-full">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
          <input
            placeholder="Search tracks, stations..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <MdCircle className="text-green-500 text-xs animate-pulse" />
          <span className="text-xs text-slate-600 font-mono tracking-wider">
            {time.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
          >
            <MdNotifications className="text-xl" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">Notifications</p>
                {unread > 0 && <span className="text-xs text-blue-600 font-medium">{unread} unread</span>}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <MdCircle className={`text-xs mt-1 flex-shrink-0 ${typeColor[n.type]}`} />
                      <div>
                        <p className={`text-xs font-semibold ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(n.time).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-1">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-tight">{user?.name}</p>
            <p className="text-[10px] text-slate-500">{user ? roleLabel[user.role] : ''}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {user?.name.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
}
