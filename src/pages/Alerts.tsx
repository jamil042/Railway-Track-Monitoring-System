import { useState, useMemo } from 'react';
import { MOCK_FAULTS } from '../data/mockData';
import type { Fault, FaultStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import { MdVisibility, MdWarning, MdAccessTime, MdPsychology, MdSensors } from 'react-icons/md';

const PER_PAGE = 6;

export default function Alerts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FaultStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Fault | null>(null);

  const filtered = useMemo(() => MOCK_FAULTS.filter(f => {
    const matchSearch = search === '' ||
      f.id.toLowerCase().includes(search.toLowerCase()) ||
      f.stationName.toLowerCase().includes(search.toLowerCase()) ||
      f.faultType.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchSearch && matchStatus;
  }), [search, statusFilter]);

  const total = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const change = (v: string) => { setStatusFilter(v as FaultStatus | 'all'); setPage(1); };

  const severityBorder: Record<string, string> = {
    critical: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-blue-500',
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Alerts & Fault Records</h1>
        <p className="text-slate-500 text-sm mt-0.5">AI-detected track faults and historical records</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search faults, stations..." />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'active', 'under_maintenance', 'fixed'] as const).map(s => (
            <button key={s} onClick={() => change(s)} className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${statusFilter === s ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600/40'}`}>
              {s === 'all' ? 'All' : s === 'under_maintenance' ? 'Maintenance' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/30">
                {['Fault ID', 'Station', 'Track', 'Fault Type', 'Severity', 'Detected', 'Status', 'Image', 'Action'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {paged.map(f => (
                <tr key={f.id} className={`hover:bg-slate-700/10 transition-colors border-l-2 ${severityBorder[f.severity]}`}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-400 whitespace-nowrap">{f.id}</td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{f.stationName.replace(' Junction', '').replace(' Central', '')}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{f.trackId}</td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{f.faultType}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.severity} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(f.detectionTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(f.detectionTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3">
                    <img src={f.imageUrl} alt="fault" className="w-12 h-8 object-cover rounded-lg bg-slate-700" />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/20 text-blue-400 text-xs font-medium rounded-lg transition-colors"
                    >
                      <MdVisibility className="text-sm" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paged.length === 0 && (
          <div className="py-16 text-center text-slate-500">
            <MdWarning className="text-4xl mx-auto mb-2 opacity-40" />
            <p>No fault records found.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Showing {Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} records</p>
        <Pagination page={page} totalPages={total} onPage={setPage} />
      </div>

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={`Fault Report — ${selected.id}`} size="xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <img src={selected.imageUrl} alt="fault" className="w-full h-52 object-cover rounded-xl bg-slate-700 mb-3" />
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800/60 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><MdPsychology className="text-purple-400" /> AI Confidence</p>
                  <p className="text-2xl font-bold text-white">{selected.aiConfidence}%</p>
                  <div className="h-1 bg-slate-700 rounded-full mt-1.5">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${selected.aiConfidence}%` }} />
                  </div>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><MdAccessTime className="text-blue-400" /> Detected</p>
                  <p className="text-sm font-semibold text-white">{new Date(selected.detectionTime).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-300 leading-relaxed">{selected.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Fault Type', value: selected.faultType },
                  { label: 'Station', value: selected.stationName },
                  { label: 'Track', value: selected.trackId },
                  { label: 'Severity', value: <StatusBadge status={selected.severity} /> },
                  { label: 'Status', value: <StatusBadge status={selected.status} /> },
                ].map(r => (
                  <div key={r.label} className="bg-slate-800/50 rounded-xl p-3">
                    <p className="text-slate-500 mb-0.5">{r.label}</p>
                    <div className="text-white font-medium">{r.value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><MdSensors className="text-blue-400" /> Sensor Values</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selected.sensorValues).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-xs text-slate-500 capitalize">{k}</span>
                      <span className="text-xs font-mono text-white">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Remarks</p>
                <p className="text-xs text-slate-300 leading-relaxed">{selected.remarks}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
