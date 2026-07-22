import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MdPerson, MdLock, MdNotifications, MdPalette, MdEdit, MdSave, MdEmail, MdBusiness } from 'react-icons/md';

type Tab = 'profile' | 'password' | 'notifications' | 'theme';

const TABS: { id: Tab; label: string; icon: typeof MdPerson }[] = [
  { id: 'profile', label: 'Profile', icon: MdPerson },
  { id: 'password', label: 'Password', icon: MdLock },
  { id: 'notifications', label: 'Notifications', icon: MdNotifications },
  { id: 'theme', label: 'Theme', icon: MdPalette },
];

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [saved, setSaved] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    criticalAlerts: true, warningAlerts: true, maintenanceUpdates: true, dailyReport: false, weeklyReport: true, emailNotif: true, smsNotif: false,
  });

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const toggleNotif = (key: keyof typeof notifPrefs) => {
    setNotifPrefs(p => ({ ...p, [key]: !p[key] }));
  };

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className={`relative w-10 h-5.5 rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-slate-600'}`} style={{ height: '22px' }}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account and preferences</p>
      </div>

      <div className="flex gap-1.5 bg-slate-800/40 border border-slate-700/40 rounded-xl p-1.5 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <t.icon className="text-base" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border-2 border-blue-500/30 flex items-center justify-center text-blue-400 text-2xl font-bold">
                {user?.name.charAt(0)}
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                <MdEdit className="text-xs" />
              </button>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{user?.name}</p>
              <p className="text-sm text-slate-500 capitalize">{user?.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', value: user?.name, icon: MdPerson },
              { label: 'Username', value: user?.username, icon: MdPerson },
              { label: 'Email Address', value: user?.email, icon: MdEmail },
              { label: 'Station', value: user?.station, icon: MdBusiness },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-slate-500 mb-1.5 block uppercase tracking-wider">{f.label}</label>
                <div className="relative">
                  <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base" />
                  <input
                    defaultValue={f.value}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/60 transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            <MdSave />{saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      )}

      {tab === 'password' && (
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Change Password</h3>
          {['Current Password', 'New Password', 'Confirm New Password'].map(label => (
            <div key={label}>
              <label className="text-xs text-slate-500 mb-1.5 block uppercase tracking-wider">{label}</label>
              <div className="relative">
                <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base" />
                <input type="password" placeholder="••••••••" className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/60 transition-colors" />
              </div>
            </div>
          ))}
          <div className="bg-slate-800/40 rounded-xl p-3">
            <p className="text-xs text-slate-500">Password requirements:</p>
            <ul className="mt-1.5 space-y-0.5">
              {['At least 8 characters', 'One uppercase letter', 'One number', 'One special character'].map(r => (
                <li key={r} className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-slate-600 rounded-full" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <button onClick={save} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            <MdSave />{saved ? 'Updated!' : 'Update Password'}
          </button>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Notification Preferences</h3>
          <div className="space-y-3">
            {[
              { key: 'criticalAlerts' as const, label: 'Critical Fault Alerts', desc: 'Instant alert for critical faults detected on any track' },
              { key: 'warningAlerts' as const, label: 'Warning Notifications', desc: 'Alerts for warning-level sensor readings' },
              { key: 'maintenanceUpdates' as const, label: 'Maintenance Progress Updates', desc: 'Updates when repair tasks change status' },
              { key: 'dailyReport' as const, label: 'Daily Summary Report', desc: 'Daily digest of fault statistics' },
              { key: 'weeklyReport' as const, label: 'Weekly Analytics Report', desc: 'Weekly performance and trend analysis' },
              { key: 'emailNotif' as const, label: 'Email Notifications', desc: 'Receive alerts via email' },
              { key: 'smsNotif' as const, label: 'SMS Notifications', desc: 'Receive critical alerts via SMS' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-700/30 last:border-0">
                <div>
                  <p className="text-sm text-white">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
                <Toggle on={notifPrefs[item.key]} onToggle={() => toggleNotif(item.key)} />
              </div>
            ))}
          </div>
          <button onClick={save} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            <MdSave />{saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>
      )}

      {tab === 'theme' && (
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Theme Settings</h3>
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Color Mode</p>
            <div className="grid grid-cols-2 gap-2">
              {[{ label: 'Dark Mode', active: true }, { label: 'Light Mode', active: false }].map(m => (
                <div key={m.label} className={`p-4 rounded-xl border cursor-pointer transition-all ${m.active ? 'border-blue-500/50 bg-blue-600/10' : 'border-slate-700/50 hover:border-slate-600/50'}`}>
                  <div className={`w-full h-12 rounded-lg mb-2 ${m.active ? 'bg-slate-900' : 'bg-slate-100'}`} />
                  <p className="text-xs text-center text-slate-300">{m.label}</p>
                  {m.active && <p className="text-[10px] text-center text-blue-400 mt-0.5">Active</p>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Accent Color</p>
            <div className="flex gap-2">
              {['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706'].map(c => (
                <button key={c} className={`w-8 h-8 rounded-full border-2 transition-all ${c === '#2563EB' ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Sidebar Position</p>
            <div className="flex gap-2">
              {['Left', 'Right'].map(pos => (
                <button key={pos} className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${pos === 'Left' ? 'border-blue-500/50 bg-blue-600/10 text-blue-400' : 'border-slate-700/50 text-slate-400 hover:border-slate-600/50'}`}>{pos}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
