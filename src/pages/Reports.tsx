import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { MONTHLY_STATS, FAULT_TYPE_DATA, STATION_FAULT_DATA, MOCK_FAULTS } from '../data/mockData';
import { MdDownload, MdTableChart, MdPictureAsPdf, MdBarChart, MdTrendingUp, MdWarning, MdCheckCircle } from 'react-icons/md';

type Period = 'daily' | 'weekly' | 'monthly';

const TOOLTIP_STYLE = {
  backgroundColor: '#1E293B', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '12px', color: '#F8FAFC', fontSize: 12,
};

const DAILY_DATA = [
  { date: 'Mon', faults: 3, fixed: 3, maintenance: 2 },
  { date: 'Tue', faults: 5, fixed: 4, maintenance: 3 },
  { date: 'Wed', faults: 2, fixed: 2, maintenance: 2 },
  { date: 'Thu', faults: 7, fixed: 5, maintenance: 4 },
  { date: 'Fri', faults: 4, fixed: 4, maintenance: 3 },
  { date: 'Sat', faults: 6, fixed: 3, maintenance: 3 },
  { date: 'Sun', faults: 5, fixed: 2, maintenance: 2 },
];

const WEEKLY_DATA = [
  { date: 'Week 1', faults: 18, fixed: 16, maintenance: 14 },
  { date: 'Week 2', faults: 24, fixed: 22, maintenance: 19 },
  { date: 'Week 3', faults: 15, fixed: 15, maintenance: 13 },
  { date: 'Week 4', faults: 31, fixed: 27, maintenance: 24 },
];

export default function Reports() {
  const [period, setPeriod] = useState<Period>('monthly');

  const chartData = period === 'daily' ? DAILY_DATA : period === 'weekly' ? WEEKLY_DATA : MONTHLY_STATS;
  const xKey = period === 'daily' ? 'date' : period === 'weekly' ? 'date' : 'month';

  const totalFaults = MOCK_FAULTS.length;
  const activeFaults = MOCK_FAULTS.filter(f => f.status === 'active').length;
  const fixedFaults = MOCK_FAULTS.filter(f => f.status === 'fixed').length;
  const underMaint = MOCK_FAULTS.filter(f => f.status === 'under_maintenance').length;

  const mostFaultyStation = STATION_FAULT_DATA[0];
  const mostCommonFault = FAULT_TYPE_DATA.sort((a, b) => b.value - a.value)[0];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Comprehensive fault analysis and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-red-600/15 hover:bg-red-600/25 border border-red-500/20 text-red-400 text-xs font-medium rounded-xl transition-colors">
            <MdPictureAsPdf /> Export PDF
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-green-600/15 hover:bg-green-600/25 border border-green-500/20 text-green-400 text-xs font-medium rounded-xl transition-colors">
            <MdTableChart /> Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Faults (All Time)', value: totalFaults, icon: MdWarning, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
          { label: 'Active Faults', value: activeFaults, icon: MdWarning, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
          { label: 'Fixed Faults', value: fixedFaults, icon: MdCheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
          { label: 'Under Maintenance', value: underMaint, icon: MdTrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
        ].map(s => (
          <div key={s.label} className={`bg-[#1E293B] border ${s.border} ${s.bg} rounded-xl p-4`}>
            <s.icon className={`text-2xl ${s.color} mb-2`} />
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Most Faulty Station</p>
          <p className="text-lg font-bold text-white">{mostFaultyStation.name}</p>
          <p className="text-sm text-red-400">{mostFaultyStation.faults} active faults</p>
        </div>
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Most Common Fault Type</p>
          <p className="text-lg font-bold text-white">{mostCommonFault.name}</p>
          <p className="text-sm text-yellow-400">{mostCommonFault.value} occurrences</p>
        </div>
      </div>

      <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><MdBarChart className="text-blue-400" /> Fault Statistics</h3>
          <div className="flex items-center gap-1.5">
            {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${period === p ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barSize={period === 'daily' ? 14 : 20}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" />
            <XAxis dataKey={xKey} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
            <Bar dataKey="faults" name="Detected" fill="#DC2626" radius={[4, 4, 0, 0]} />
            <Bar dataKey="fixed" name="Fixed" fill="#16A34A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="maintenance" name="Maintenance" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Faults by Station</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={STATION_FAULT_DATA} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="faults" name="Faults" radius={[0, 4, 4, 0]}>
                {STATION_FAULT_DATA.map((_, i) => <Cell key={i} fill={['#DC2626', '#F59E0B', '#F59E0B', '#3B82F6', '#3B82F6', '#6B7280'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Fault Type Distribution</h3>
          <div className="space-y-2.5">
            {FAULT_TYPE_DATA.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">{d.name}</span>
                  <span className="text-slate-300 font-medium">{d.value}</span>
                </div>
                <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / 22) * 100}%`, backgroundColor: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
