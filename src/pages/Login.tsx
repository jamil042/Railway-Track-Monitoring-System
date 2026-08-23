import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MdTrain, MdLock, MdPerson, MdVisibility, MdVisibilityOff, MdWarning, MdAdminPanelSettings, MdEngineering, MdBadge } from 'react-icons/md';

type Role = 'railway_administrator' | 'station_incharge' | 'maintenance_team';

const ROLES: { id: Role; label: string; icon: typeof MdPerson; hint: string }[] = [
  { id: 'railway_administrator', label: 'Railway Administrator', icon: MdAdminPanelSettings, hint: 'Username + Password' },
  { id: 'station_incharge', label: 'Station Incharge', icon: MdBadge, hint: 'Station ID + Password' },
  { id: 'maintenance_team', label: 'Maintenance Team', icon: MdEngineering, hint: 'Station ID + Password' },
];

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('railway_administrator');
  const [form, setForm] = useState({ username: '', stationId: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/dashboard'); }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  const isStationLogin = role !== 'railway_administrator';
  const selectedRole = ROLES.find(r => r.id === role)!;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(
      role,
      isStationLogin ? null : form.username,
      isStationLogin ? form.stationId.toUpperCase() : null,
      form.password,
    );
    setLoading(false);
    if (result === 'ok') navigate('/dashboard');
    else if (result === 'unreachable')
      setError('Cannot reach the backend API (port 5000). Make sure it is running, then try again.');
    else
      setError(
        isStationLogin
          ? 'Invalid Station ID or password. Please try again.'
          : 'Invalid username or password. Please try again.',
      );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-xl shadow-blue-300/50">
            <MdTrain className="text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">RailGuard</h1>
          <p className="text-slate-500 text-sm mt-1">Bangladesh Railway Track Fault Detection System</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-200/60">
          <h2 className="text-base font-semibold text-slate-800 mb-5">Control Center Login</h2>

          {/* Role selector */}
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Select Your Role</label>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {ROLES.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 transition-all ${role === r.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <r.icon className={`text-xl ${role === r.id ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className={`text-[11px] font-semibold leading-tight text-center ${role === r.id ? 'text-blue-700' : 'text-slate-500'}`}>{r.label}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <MdWarning className="text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isStationLogin ? (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Station ID</label>
                <div className="relative">
                  <MdBadge className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                  <input
                    type="text"
                    value={form.stationId}
                    onChange={e => setForm(f => ({ ...f, stationId: e.target.value }))}
                    placeholder="e.g. ST01"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-mono uppercase"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">You will only see data for this station.</p>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Username</label>
                <div className="relative">
                  <MdPerson className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="Enter your username"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <MdLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 bg-white accent-blue-600"
                />
                <span className="text-sm text-slate-600">Remember me</span>
              </label>
              <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Authenticating...</>
              ) : `Login as ${selectedRole.label}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
