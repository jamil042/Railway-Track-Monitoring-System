import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import TrackCard from '../components/TrackCard';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import type { TrackStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MdRadar, MdCheckCircle, MdWarning, MdDangerous } from 'react-icons/md';

const PER_PAGE = 9;

/** Ek page e ekmatro ekta live camera stream chole (prothonom hardware track). */
function firstLiveId(tracks: { id: string }[]): string | undefined {
  return tracks.find(t => {
    const seq = parseInt(t.id.replace('TR-', ''), 10);
    return Number.isFinite(seq) && seq % 5 === 1;
  })?.id;
}

const STATUS_FILTERS: { label: string; value: TrackStatus | 'all'; icon: typeof MdCheckCircle; iconColor: string; bg: string; border: string }[] = [
  { label: 'All Tracks', value: 'all', icon: MdRadar, iconColor: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  { label: 'Safe', value: 'safe', icon: MdCheckCircle, iconColor: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  { label: 'Warning', value: 'warning', icon: MdWarning, iconColor: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { label: 'Critical', value: 'critical', icon: MdDangerous, iconColor: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
];

export default function Monitoring() {
  const { tracks, stations } = useData();
  const { user } = useAuth();
  const isAdmin = user?.role === 'railway_administrator';

  // Admin: station selector diye filter korte parbe. Non-admin ke backend
  // already sudhu tar nijer station-er track pathay, tai extra filter lagbe na.
  const [stationFilter, setStationFilter] = useState<string>('all');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrackStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const visibleTracks = useMemo(() => {
    if (!isAdmin || stationFilter === 'all') return tracks;
    return tracks.filter(t => t.stationId === stationFilter);
  }, [tracks, isAdmin, stationFilter]);

  const filtered = useMemo(() => {
    return visibleTracks.filter(t => {
      const matchSearch = search === '' ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.stationName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter, visibleTracks]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const counts = {
    all: visibleTracks.length,
    safe: visibleTracks.filter(t => t.status === 'safe').length,
    warning: visibleTracks.filter(t => t.status === 'warning').length,
    critical: visibleTracks.filter(t => t.status === 'critical').length,
  };

  const handleFilterChange = (v: TrackStatus | 'all') => { setStatusFilter(v); setPage(1); };
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live Railway Monitoring</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time track status across all Bangladesh Railway stations</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Station</label>
            <select
              value={stationFilter}
              onChange={e => { setStationFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            >
              <option value="all">All Stations ({tracks.length} tracks)</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`bg-white border rounded-xl p-3.5 flex items-center gap-3 transition-all text-left shadow-sm hover:shadow-md ${statusFilter === f.value ? `${f.bg} ${f.border} ring-2 ring-offset-1 ring-blue-200` : 'border-slate-200 hover:border-slate-300'}`}
          >
            <f.icon className={`text-2xl ${f.iconColor}`} />
            <div>
              <p className="text-xl font-bold text-slate-900">{counts[f.value]}</p>
              <p className="text-xs text-slate-500">{f.label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar value={search} onChange={handleSearch} placeholder="Search by track ID or station..." />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${statusFilter === f.value ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {paged.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <MdRadar className="text-4xl mx-auto mb-2 opacity-40" />
          <p>No tracks found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {paged.map(t => (
            <TrackCard
              key={t.id}
              track={t}
              liveCam={t.id === firstLiveId(paged)}
            />
          ))}
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
