import { useState, useMemo } from 'react';
import { MOCK_TRACKS } from '../data/mockData';
import TrackCard from '../components/TrackCard';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import type { TrackStatus } from '../types';
import { MdRadar, MdCheckCircle, MdWarning, MdDangerous } from 'react-icons/md';

const PER_PAGE = 9;

const STATUS_FILTERS: { label: string; value: TrackStatus | 'all'; icon: typeof MdCheckCircle; color: string }[] = [
  { label: 'All', value: 'all', icon: MdRadar, color: 'text-slate-400' },
  { label: 'Safe', value: 'safe', icon: MdCheckCircle, color: 'text-green-400' },
  { label: 'Warning', value: 'warning', icon: MdWarning, color: 'text-yellow-400' },
  { label: 'Critical', value: 'critical', icon: MdDangerous, color: 'text-red-400' },
];

export default function Monitoring() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrackStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return MOCK_TRACKS.filter(t => {
      const matchSearch = search === '' ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.stationName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const counts = {
    all: MOCK_TRACKS.length,
    safe: MOCK_TRACKS.filter(t => t.status === 'safe').length,
    warning: MOCK_TRACKS.filter(t => t.status === 'warning').length,
    critical: MOCK_TRACKS.filter(t => t.status === 'critical').length,
  };

  const handleFilterChange = (v: TrackStatus | 'all') => { setStatusFilter(v); setPage(1); };
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Live Railway Monitoring</h1>
        <p className="text-slate-500 text-sm mt-0.5">Real-time track status across all stations</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`bg-[#1E293B] border rounded-xl p-3 flex items-center gap-3 transition-all text-left ${statusFilter === f.value ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-700/50 hover:border-slate-600/50'}`}
          >
            <f.icon className={`text-2xl ${f.color}`} />
            <div>
              <p className="text-lg font-bold text-white">{counts[f.value]}</p>
              <p className="text-xs text-slate-500">{f.label} Tracks</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar value={search} onChange={handleSearch} placeholder="Search by track ID or station..." />
        </div>
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${statusFilter === f.value ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600/40'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {paged.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MdRadar className="text-4xl mx-auto mb-2 opacity-40" />
          <p>No tracks found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {paged.map(t => <TrackCard key={t.id} track={t} />)}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Showing {Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} tracks
        </p>
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>
    </div>
  );
}
