import { MdLocationCity, MdLinearScale, MdWarning, MdDangerous, MdCheckCircle, MdBuild, MdTrendingUp, MdAccessTime } from 'react-icons/md';
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { DASHBOARD_STATS, FAULT_TREND_DATA, FAULT_TYPE_DATA, MOCK_FAULTS } from '../data/mockData';

const RECENT = MOCK_FAULTS.slice(0, 5);

const TOOLTIP_STYLE = {
  backgroundColor: '#1E293B', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '12px', color: '#F8FAFC', fontSize: 12,
};

export default function Dashboard() {
  const s = DASHBOARD_STATS;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">System Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          {' · '}
          <span className="text-yellow-400">System Status: <StatusBadge status={s.systemStatus} /></span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Stations" value={s.totalStations} icon={<MdLocationCity />} color="blue" />
        <StatCard title="Total Tracks" value={s.totalTracks} icon={<MdLinearScale />} color="purple" />
        <StatCard title="Active Faults" value={s.activeFaults} icon={<MdWarning />} color="yellow" trend={{ value: 12, label: 'vs yesterday' }} />
        <StatCard title="Critical Faults" value={s.criticalFaults} icon={<MdDangerous />} color="red" trend={{ value: 5, label: 'vs yesterday' }} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Fixed Today" value={s.fixedToday} icon={<MdCheckCircle />} color="green" subtitle="Track faults resolved" />
        <StatCard title="Under Maintenance" value={s.underMaintenance} icon={<MdBuild />} color="yellow" subtitle="Ongoing repairs" />
        <StatCard title="Network Uptime" value="98.4%" icon={<MdTrendingUp />} color="blue" subtitle="Sensor network" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Fault Detection Trend — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={FAULT_TREND_DATA}>
              <defs>
                <linearGradient id="faults" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fixed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" />
              <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
              <Area type="monotone" dataKey="faults" stroke="#DC2626" fill="url(#faults)" strokeWidth={2} name="Detected" />
              <Area type="monotone" dataKey="fixed" stroke="#16A34A" fill="url(#fixed)" strokeWidth={2} name="Fixed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Fault Distribution by Type</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={FAULT_TYPE_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {FAULT_TYPE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 min-w-max">
              {FAULT_TYPE_DATA.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-slate-400">{d.name}</span>
                  <span className="text-xs font-semibold text-white ml-auto pl-2">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Recent Fault Alerts</h3>
          <a href="/alerts" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {['Fault ID', 'Station', 'Track', 'Fault Type', 'Severity', 'Detected', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {RECENT.map(f => (
                <tr key={f.id} className="hover:bg-slate-700/10 transition-colors">
                  <td className="py-3 pr-4 font-mono text-xs text-blue-400">{f.id}</td>
                  <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">{f.stationName.split(' ')[0]}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-400">{f.trackId}</td>
                  <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">{f.faultType}</td>
                  <td className="py-3 pr-4"><StatusBadge status={f.severity} /></td>
                  <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap flex items-center gap-1">
                    <MdAccessTime className="text-slate-600" />
                    {new Date(f.detectionTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3"><StatusBadge status={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Latest Activity</h3>
        <div className="space-y-3">
          {[
            { time: '08:34', text: 'Rail fracture detected on TR-011 at Howrah Junction', color: 'bg-red-500', type: 'critical' },
            { time: '07:30', text: 'Alpha Team began repairs on TR-001 track misalignment', color: 'bg-blue-500', type: 'info' },
            { time: '06:00', text: 'Beta Team dispatched to TR-004 weld crack — Howrah Junction', color: 'bg-yellow-500', type: 'warning' },
            { time: '23:45', text: 'Joint gap excess on TR-012 at Mumbai Central — FIXED', color: 'bg-green-500', type: 'success' },
            { time: '22:40', text: 'Rail wear warning detected on TR-008 at Hyderabad Deccan', color: 'bg-yellow-500', type: 'warning' },
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xs text-slate-600 font-mono mt-0.5 w-10 flex-shrink-0">{a.time}</span>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.color}`} />
              <p className="text-xs text-slate-400">{a.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
