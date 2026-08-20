import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import TrackCard from '../components/TrackCard';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import type { TrackStatus } from '../types';
import { MdRadar, MdCheckCircle, MdWarning, MdDangerous, MdVideocam, MdStop } from 'react-icons/md';

const PER_PAGE = 9;

const CAMERA_STREAM_URL = 'http://192.168.0.105:8081/stream';

const STATUS_FILTERS: { label: string; value: TrackStatus | 'all'; icon: typeof MdCheckCircle; iconColor: string; bg: string; border: string }[] = [
  { label: 'All Tracks', value: 'all', icon: MdRadar, iconColor: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  { label: 'Safe', value: 'safe', icon: MdCheckCircle, iconColor: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  { label: 'Warning', value: 'warning', icon: MdWarning, iconColor: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { label: 'Critical', value: 'critical', icon: MdDangerous, iconColor: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
];

export default function Monitoring() {
  const { tracks } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrackStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [showCamera, setShowCamera] = useState(false);

  const filtered = useMemo(() => {
    return tracks.filter(t => {
      const matchSearch = search === '' ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.stationName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter, tracks]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const counts = {
    all: tracks.length,
    safe: tracks.filter(t => t.status === 'safe').length,
    warning: tracks.filter(t => t.status === 'warning').length,
    critical: tracks.filter(t => t.status === 'critical').length,
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
        <button
          onClick={() => setShowCamera(!showCamera)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border shadow-sm ${
            showCamera
              ? 'bg-red-600 border-red-600 text-white shadow-red-200'
              : 'bg-blue-600 border-blue-600 text-white shadow-blue-200 hover:bg-blue-700'
          }`}
        >
          {showCamera ? <><MdStop className="text-lg" /> Stop Camera</> : <><MdVideocam className="text-lg" /> Live Camera</>}
        </button>
      </div>

      {showCamera && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-white tracking-wide">LIVE CAMERA — YOLO Detection Active</span>
          </div>
          <div className="bg-black flex items-center justify-center" style={{ minHeight: 400 }}>
            <img
              src={CAMERA_STREAM_URL}
              alt="Live Railway Camera"
              className="max-w-full max-h-[500px] object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23666" font-size="14">Camera stream unavailable — run camera_stream.py on Pi</text></svg>';
              }}
            />
          </div>
        </div>
      )}

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
