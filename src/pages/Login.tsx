import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MdTrain, MdLock, MdPerson, MdVisibility, MdVisibilityOff, MdWarning } from 'react-icons/md';

const DEMO_CREDENTIALS = [
  { role: 'Railway Administrator', username: 'admin', password: 'admin123' },
  { role: 'Station Incharge', username: 'incharge', password: 'incharge123' },
  { role: 'Maintenance Team', username: 'maintenance', password: 'maint123' },
];

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) { navigate('/dashboard'); return null; }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(form.username, form.password);
    setLoading(false);
    if (ok) navigate('/dashboard');
    else setError('Invalid username or password. Please try again.');
  };

  const fillDemo = (u: string, p: string) => setForm(f => ({ ...f, username: u, password: p }));

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
          <h1 className="text-2xl font-bold text-slate-900">RailGuard AI</h1>
          <p className="text-slate-500 text-sm mt-1">Bangladesh Railway Track Fault Detection System</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-200/60">
          <h2 className="text-base font-semibold text-slate-800 mb-5">Control Center Login</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <MdWarning className="text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              ) : 'Login to Dashboard'}
            </button>
          </form>
        </div>

        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-2.5 font-semibold uppercase tracking-wider">Demo Credentials</p>
          <div className="space-y-1.5">
            {DEMO_CREDENTIALS.map(d => (
              <button
                key={d.username}
                onClick={() => fillDemo(d.username, d.password)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 transition-colors text-left group"
              >
                <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700">{d.role}</span>
                <span className="text-xs font-mono text-slate-400 group-hover:text-blue-500">{d.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
