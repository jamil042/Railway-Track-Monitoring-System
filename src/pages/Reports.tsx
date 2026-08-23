import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useData } from '../contexts/DataContext';
import { MdTableChart, MdPictureAsPdf, MdBarChart, MdWarning, MdCheckCircle, MdTrendingUp } from 'react-icons/md';

type Period = 'daily' | 'weekly' | 'monthly';

const TOOLTIP_STYLE = {
  backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
};

export default function Reports() {
  const { monthlyStats, faultTypeData, stationFaultData, faults } = useData();
  const [period, setPeriod] = useState<Period>('monthly');

  type ChartRow = { date?: string; month?: string; faults: number; fixed: number; maintenance: number };

  // Daily/Weekly chart-o database-er fault record theke compute hoy — kono dummy data nei.
  const computedStats = useMemo<ChartRow[]>(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    if (period === 'daily') {
      // Last 7 days, day-name onujayi group
      const buckets = new Map<string, { faults: number; fixed: number; maintenance: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * DAY);
        buckets.set(d.toLocaleDateString('en-BD', { weekday: 'short' }), { faults: 0, fixed: 0, maintenance: 0 });
      }
      for (const f of faults) {
        const age = now - new Date(f.detectionTime).getTime();
        if (age < 0 || age > 7 * DAY) continue;
        const key = new Date(f.detectionTime).toLocaleDateString('en-BD', { weekday: 'short' });
        const b = buckets.get(key);
        if (b) {
          b.faults++;
          if (f.status === 'fixed') b.fixed++;
          if (f.status === 'under_maintenance') b.maintenance++;
        }
      }
      return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
    }
    // Weekly: last 4 weeks
    const buckets = new Map<string, { faults: number; fixed: number; maintenance: number }>();
    for (let w = 3; w >= 0; w--) buckets.set(`Week ${4 - w}`, { faults: 0, fixed: 0, maintenance: 0 });
    for (const f of faults) {
      const age = now - new Date(f.detectionTime).getTime();
      if (age < 0 || age > 28 * DAY) continue;
      const weekIdx = Math.min(3, Math.floor(age / (7 * DAY)));
      const key = `Week ${4 - weekIdx}`;
      const b = buckets.get(key);
      if (b) {
        b.faults++;
        if (f.status === 'fixed') b.fixed++;
        if (f.status === 'under_maintenance') b.maintenance++;
      }
    }
    return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  }, [period, faults]);

  const chartData = (
    period === 'monthly' ? monthlyStats : computedStats
  ) as ChartRow[];
  const xKey = period === 'monthly' ? 'month' : 'date';

  const totalFaults = faults.length;
  const activeFaults = faults.filter(f => f.status === 'active').length;
  const fixedFaults = faults.filter(f => f.status === 'fixed').length;
  const underMaint = faults.filter(f => f.status === 'under_maintenance').length;

  const mostFaultyStation = stationFaultData[0];
  const mostCommonFault = [...faultTypeData].sort((a, b) => b.value - a.value)[0];
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Comprehensive fault analysis and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold rounded-xl transition-colors">
            <MdPictureAsPdf /> Export PDF
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-xs font-semibold rounded-xl transition-colors">
            <MdTableChart /> Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Faults (All Time)', value: totalFaults, icon: MdWarning, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
          { label: 'Active Faults', value: activeFaults, icon: MdWarning, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
          { label: 'Fixed Faults', value: fixedFaults, icon: MdCheckCircle, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Under Maintenance', value: underMaint, icon: MdTrendingUp, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`bg-white border ${s.border} rounded-xl p-4 shadow-sm`}>
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`text-xl ${s.color}`} />
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1 font-medium">Most Faulty Station</p>
          {mostFaultyStation ? (
            <>
              <p className="text-lg font-bold text-slate-900">{mostFaultyStation.name}</p>
              <p className="text-sm text-red-600 font-semibold">{mostFaultyStation.faults} active faults</p>
            </>
          ) : (
            <p className="text-lg font-bold text-slate-400">No fault data yet</p>
          )}
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1 font-medium">Most Common Fault Type</p>
          {mostCommonFault ? (
            <>
              <p className="text-lg font-bold text-slate-900">{mostCommonFault.name}</p>
              <p className="text-sm text-yellow-600 font-semibold">{mostCommonFault.value} occurrences</p>
            </>
          ) : (
            <p className="text-lg font-bold text-slate-400">No fault data yet</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <MdBarChart className="text-blue-600 text-lg" /> Fault Statistics
          </h3>
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
            {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${period === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barSize={period === 'daily' ? 14 : 20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey={xKey} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
            <Bar dataKey="faults" name="Detected" fill="#DC2626" radius={[4, 4, 0, 0]} opacity={0.85} />
            <Bar dataKey="fixed" name="Fixed" fill="#16A34A" radius={[4, 4, 0, 0]} opacity={0.85} />
            <Bar dataKey="maintenance" name="Maintenance" fill="#2563EB" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Faults by Station</h3>
          <div className="space-y-3">
            {stationFaultData.map((d, i) => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-700 font-medium">{d.name}</span>
                  <span className="text-slate-500 font-semibold">{d.faults} faults</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${stationFaultData[0].faults > 0 ? (d.faults / stationFaultData[0].faults) * 100 : 0}%`,
                      backgroundColor: ['#DC2626', '#F59E0B', '#F59E0B', '#3B82F6', '#3B82F6', '#94A3B8'][i],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Fault Type Breakdown</h3>
          <div className="space-y-3">
            {faultTypeData.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-700">{d.name}</span>
                  </span>
                  <span className="text-slate-500 font-semibold">{d.value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.value / Math.max(1, ...faultTypeData.map(x => x.value))) * 100)}%`, backgroundColor: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
