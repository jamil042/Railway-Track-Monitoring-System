import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import type { Fault, FaultStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import { MdVisibility, MdWarning, MdAccessTime, MdPsychology, MdSensors } from 'react-icons/md';

const PER_PAGE = 6;

export default function Alerts() {
  const { faults } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FaultStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Fault | null>(null);

  const filtered = useMemo(() => faults.filter(f => {
    const matchSearch = search === '' ||
      f.id.toLowerCase().includes(search.toLowerCase()) ||
      f.stationName.toLowerCase().includes(search.toLowerCase()) ||
      f.faultType.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchSearch && matchStatus;
  }), [search, statusFilter, faults]);

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
        <h1 className="text-xl font-bold text-slate-900">Alerts & Fault Records</h1>
        <p className="text-slate-500 text-sm mt-0.5">AI-detected track faults and historical records</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search faults, stations..." />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'active', 'under_maintenance', 'fixed'] as const).map(s => (
            <button key={s} onClick={() => change(s)} className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${statusFilter === s ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
              {s === 'all' ? 'All Records' : s === 'under_maintenance' ? 'Maintenance' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Fault ID', 'Station', 'Track', 'Fault Type', 'Severity', 'Detected', 'Status', 'Image', 'Action'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paged.map(f => (
                <tr key={f.id} className={`hover:bg-slate-50 transition-colors border-l-2 ${severityBorder[f.severity]}`}>
                  <td className="px-4 py-3.5 font-mono text-xs text-blue-600 font-semibold whitespace-nowrap">{f.id}</td>
                  <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap text-xs">{f.stationName.split(' ').slice(0, 2).join(' ')}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{f.trackId}</td>
                  <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap text-xs">{f.faultType}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={f.severity} /></td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(f.detectionTime).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(f.detectionTime).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3.5">
                    <img src={f.imageUrl} alt="fault" className="w-12 h-8 object-cover rounded-lg bg-slate-100 border border-slate-200" />
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => setSelected(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg transition-colors"
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
          <div className="py-16 text-center text-slate-400">
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
              <img src={selected.imageUrl} alt="fault" className="w-full h-52 object-cover rounded-xl bg-slate-100 mb-3 border border-slate-200" />
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><MdPsychology className="text-purple-500" /> AI Confidence</p>
                  <p className="text-2xl font-bold text-slate-900">{selected.aiConfidence}%</p>
                  <div className="h-1.5 bg-purple-100 rounded-full mt-1.5">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${selected.aiConfidence}%` }} />
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><MdAccessTime className="text-blue-500" /> Detected</p>
                  <p className="text-xs font-semibold text-slate-800">{new Date(selected.detectionTime).toLocaleString('en-BD')}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1 font-medium">Description</p>
                <p className="text-xs text-slate-700 leading-relaxed">{selected.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Fault Type', value: selected.faultType },
                  { label: 'Station', value: selected.stationName.split(' ').slice(0, 2).join(' ') },
                  { label: 'Track ID', value: selected.trackId },
                  { label: 'Severity', value: <StatusBadge status={selected.severity} /> },
                  { label: 'Status', value: <StatusBadge status={selected.status} /> },
                ].map(r => (
                  <div key={r.label} className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-slate-400 text-[10px] mb-0.5 uppercase tracking-wider">{r.label}</p>
                    <div className="text-slate-800 font-medium text-xs">{r.value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1"><MdSensors className="text-blue-500" /> Sensor Readings</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(selected.sensorValues).map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-xs text-slate-500 capitalize">{k}</span>
                      <span className="text-xs font-mono font-semibold text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs text-yellow-700 font-medium mb-1">Remarks</p>
                <p className="text-xs text-yellow-800 leading-relaxed">{selected.remarks}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
