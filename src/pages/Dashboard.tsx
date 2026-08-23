import { useMemo } from 'react';
import { MdLocationCity, MdLinearScale, MdWarning, MdDangerous, MdCheckCircle, MdBuild, MdTrendingUp, MdAccessTime } from 'react-icons/md';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useData } from '../contexts/DataContext';

const TOOLTIP_STYLE = {
  backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
};

export default function Dashboard() {
  const { stats: s, faultTrend, faultTypeData, faults, tracks, readings } = useData();
  const RECENT = faults.slice(0, 5);

  // Network uptime = live sensor coverage: koto % track-er recent (5 min-er moddhe) reading ache.
  // Puro tao database er sensor_readings theke compute hoy — kono fixed number na.
  const networkUptime = useMemo(() => {
    if (tracks.length === 0) return '—';
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const liveTrackIds = new Set(
      readings.filter(r => new Date(r.recordedAt).getTime() >= fiveMinAgo).map(r => r.trackId),
    );
    const pct = Math.round((tracks.filter(t => liveTrackIds.has(t.id)).length / tracks.length) * 100);
    return `${pct}%`;
  }, [tracks, readings]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">System Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
          {new Date().toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          <span className="flex items-center gap-1.5">· System Status: <StatusBadge status={s.systemStatus} /></span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Stations" value={s.totalStations} icon={<MdLocationCity />} color="blue" />
        <StatCard title="Total Tracks" value={s.totalTracks} icon={<MdLinearScale />} color="purple" />
        <StatCard title="Active Faults" value={s.activeFaults} icon={<MdWarning />} color="yellow" />
        <StatCard title="Critical Faults" value={s.criticalFaults} icon={<MdDangerous />} color="red" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Fixed Today" value={s.fixedToday} icon={<MdCheckCircle />} color="green" subtitle="Track faults resolved" />
        <StatCard title="Under Maintenance" value={s.underMaintenance} icon={<MdBuild />} color="yellow" subtitle="Ongoing repairs" />
        <StatCard title="Network Uptime" value={networkUptime} icon={<MdTrendingUp />} color="blue" subtitle="Live sensor coverage" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Fault Detection Trend — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={faultTrend}>
              <defs>
                <linearGradient id="faults" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fixed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
              <Area type="monotone" dataKey="faults" stroke="#DC2626" fill="url(#faults)" strokeWidth={2} name="Detected" />
              <Area type="monotone" dataKey="fixed" stroke="#16A34A" fill="url(#fixed)" strokeWidth={2} name="Fixed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Fault Distribution by Type</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={faultTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {faultTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 min-w-max">
              {faultTypeData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-slate-500">{d.name}</span>
                  <span className="text-xs font-semibold text-slate-800 ml-auto pl-2">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Recent Fault Alerts</h3>
          <a href="/alerts" className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Fault ID', 'Station', 'Track', 'Fault Type', 'Severity', 'Detected', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold pb-3 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {RECENT.map(f => (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 font-mono text-xs text-blue-600 font-medium">{f.id}</td>
                  <td className="py-3 pr-4 text-slate-700 whitespace-nowrap">{f.stationName.split(' ')[0]}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{f.trackId}</td>
                  <td className="py-3 pr-4 text-slate-700 whitespace-nowrap">{f.faultType}</td>
                  <td className="py-3 pr-4"><StatusBadge status={f.severity} /></td>
                  <td className="py-3 pr-4 text-slate-400 text-xs whitespace-nowrap flex items-center gap-1">
                    <MdAccessTime className="text-slate-300" />
                    {new Date(f.detectionTime).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3"><StatusBadge status={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Latest Activity</h3>
        <div className="space-y-3">
          {[
            { time: '08:34', text: 'Rail fracture detected on TR-011 at Khulna Railway Station', color: 'bg-red-500' },
            { time: '07:30', text: 'Alpha Team began repairs on TR-001 track misalignment — Kamalapur', color: 'bg-blue-500' },
            { time: '06:00', text: 'Beta Team dispatched to TR-004 weld crack — Khulna Railway Station', color: 'bg-yellow-500' },
            { time: '23:45', text: 'Joint gap excess on TR-012 at Chattogram Central — FIXED', color: 'bg-green-500' },
            { time: '22:40', text: 'Rail wear warning detected on TR-008 at Mymensingh Station', color: 'bg-yellow-500' },
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xs text-slate-400 font-mono mt-0.5 w-10 flex-shrink-0">{a.time}</span>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.color}`} />
              <p className="text-xs text-slate-600 leading-relaxed">{a.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
