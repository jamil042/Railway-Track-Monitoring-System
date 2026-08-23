import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import TrackCard from '../components/TrackCard';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import type { TrackStatus } from '../types';
import { MdRadar, MdCheckCircle, MdWarning, MdDangerous } from 'react-icons/md';

const PER_PAGE = 9;

const STATUS_FILTERS: { label: string; value: TrackStatus | 'all'; icon: typeof MdCheckCircle; iconColor: string; bg: string; border: string }[] = [
  { label: 'All Tracks', value: 'all', icon: MdRadar, iconColor: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  { label: 'Safe', value: 'safe', icon: MdCheckCircle, iconColor: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  { label: 'Warning', value: 'warning', icon: MdWarning, iconColor: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { label: 'Critical', value: 'critical', icon: MdDangerous, iconColor: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
];

export default function Monitoring() {
  const { tracks, readings } = useData();

  // শুধু যে track-গুলোতে live sensor readings আছে সেগুলোই দেখাও (যেমন TR-001, TR-002)।
  // বাকি placeholder/seed-only track cards এড়িয়ে যাও — array change না হলে ওগুলো কেবল জায়গা নেয়।
  const liveTrackIds = useMemo(
    () => new Set(readings.map(r => r.trackId).filter(Boolean)),
    [readings],
  );
  const liveTracks = useMemo(() => tracks.filter(t => liveTrackIds.has(t.id)), [tracks, liveTrackIds]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrackStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return liveTracks.filter(t => {
      const matchSearch = search === '' ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.stationName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter, liveTracks]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const counts = {
    all: liveTracks.length,
    safe: liveTracks.filter(t => t.status === 'safe').length,
    warning: liveTracks.filter(t => t.status === 'warning').length,
    critical: liveTracks.filter(t => t.status === 'critical').length,
  };

  const handleFilterChange = (v: TrackStatus | 'all') => { setStatusFilter(v); setPage(1); };
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live Railway Monitoring</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time track status across all Bangladesh Railway stations</p>
        </div>
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
