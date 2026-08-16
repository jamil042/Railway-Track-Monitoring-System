import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MdPerson, MdLock, MdNotifications, MdPalette, MdEdit, MdSave, MdEmail, MdBusiness, MdCheckCircle } from 'react-icons/md';

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
    <button
      onClick={onToggle}
      className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-slate-300'}`}
      style={{ height: '22px' }}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account and preferences</p>
      </div>

      <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon className="text-base" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 border-2 border-blue-200 flex items-center justify-center text-blue-700 text-2xl font-bold">
                {user?.name.charAt(0)}
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md">
                <MdEdit className="text-xs" />
              </button>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{user?.name}</p>
              <p className="text-sm text-slate-500 capitalize">{user?.role.replace(/_/g, ' ')}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-full">{user?.station}</span>
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
                <label className="text-xs text-slate-500 mb-1.5 block font-semibold uppercase tracking-wider">{f.label}</label>
                <div className="relative">
                  <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
                  <input
                    defaultValue={f.value}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${saved ? 'bg-green-600 text-white shadow-green-200' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}>
            {saved ? <><MdCheckCircle /> Saved!</> : <><MdSave /> Save Changes</>}
          </button>
        </div>
      )}

      {tab === 'password' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100">Change Password</h3>
          {['Current Password', 'New Password', 'Confirm New Password'].map(label => (
            <div key={label}>
              <label className="text-xs text-slate-500 mb-1.5 block font-semibold uppercase tracking-wider">{label}</label>
              <div className="relative">
                <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
                <input type="password" placeholder="••••••••" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
            </div>
          ))}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700 font-semibold mb-1.5">Password Requirements</p>
            <ul className="space-y-1">
              {['At least 8 characters', 'One uppercase letter', 'One number', 'One special character'].map(r => (
                <li key={r} className="text-xs text-blue-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-blue-400 rounded-full" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <button onClick={save} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${saved ? 'bg-green-600 text-white shadow-green-200' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}>
            {saved ? <><MdCheckCircle /> Updated!</> : <><MdSave /> Update Password</>}
          </button>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <h3 className="text-sm font-semibold text-slate-800 pb-4 border-b border-slate-100 mb-1">Notification Preferences</h3>
          {[
            { key: 'criticalAlerts' as const, label: 'Critical Fault Alerts', desc: 'Instant alert for critical faults detected on any track' },
            { key: 'warningAlerts' as const, label: 'Warning Notifications', desc: 'Alerts for warning-level sensor readings' },
            { key: 'maintenanceUpdates' as const, label: 'Maintenance Progress Updates', desc: 'Updates when repair tasks change status' },
            { key: 'dailyReport' as const, label: 'Daily Summary Report', desc: 'Daily digest of fault statistics' },
            { key: 'weeklyReport' as const, label: 'Weekly Analytics Report', desc: 'Weekly performance and trend analysis' },
            { key: 'emailNotif' as const, label: 'Email Notifications', desc: 'Receive alerts via email' },
            { key: 'smsNotif' as const, label: 'SMS Notifications', desc: 'Receive critical alerts via SMS' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-3.5 border-b border-slate-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <Toggle on={notifPrefs[item.key]} onToggle={() => toggleNotif(item.key)} />
            </div>
          ))}
          <div className="pt-3">
            <button onClick={save} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${saved ? 'bg-green-600 text-white shadow-green-200' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}>
              {saved ? <><MdCheckCircle /> Saved!</> : <><MdSave /> Save Preferences</>}
            </button>
          </div>
        </div>
      )}

      {tab === 'theme' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-slate-800 pb-4 border-b border-slate-100">Theme Settings</h3>
          <div>
            <p className="text-xs text-slate-500 mb-3 font-semibold uppercase tracking-wider">Color Mode</p>
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              {[
                { label: 'Light Mode', active: true, preview: 'bg-slate-100' },
                { label: 'Dark Mode', active: false, preview: 'bg-slate-800' },
              ].map(m => (
                <div key={m.label} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${m.active ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className={`w-full h-10 rounded-lg mb-2 ${m.preview} border border-slate-200`} />
                  <p className="text-xs text-center text-slate-700 font-medium">{m.label}</p>
                  {m.active && <p className="text-[10px] text-center text-blue-600 mt-0.5 font-semibold">Active</p>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-3 font-semibold uppercase tracking-wider">Accent Color</p>
            <div className="flex gap-2">
              {['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706'].map(c => (
                <button key={c} className={`w-8 h-8 rounded-full border-2 transition-all ${c === '#2563EB' ? 'border-blue-600 ring-2 ring-offset-2 ring-blue-300 scale-110' : 'border-white shadow-md hover:scale-105'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-3 font-semibold uppercase tracking-wider">Sidebar Position</p>
            <div className="flex gap-2">
              {['Left', 'Right'].map(pos => (
                <button key={pos} className={`px-5 py-2 rounded-xl text-xs font-semibold border transition-all ${pos === 'Left' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{pos}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
