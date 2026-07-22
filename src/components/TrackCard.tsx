import type { Track } from '../types';
import StatusBadge from './StatusBadge';
import { MdSensors, MdAccessTime, MdThermostat, MdSpeed } from 'react-icons/md';

interface TrackCardProps {
  track: Track;
}

export default function TrackCard({ track }: TrackCardProps) {
  const healthColor = track.sensorHealth >= 85 ? 'text-green-400' : track.sensorHealth >= 60 ? 'text-yellow-400' : 'text-red-400';
  const healthBg = track.sensorHealth >= 85 ? 'bg-green-500' : track.sensorHealth >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600/60 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group">
      <div className="relative h-36 bg-slate-800 overflow-hidden">
        <img
          src={track.imageUrl}
          alt={`Track ${track.id} camera snapshot`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E293B] via-transparent to-transparent" />
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={track.status} />
        </div>
        <div className="absolute bottom-2.5 right-2.5 text-xs text-slate-300 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md font-mono">
          LIVE CAM
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-white font-mono tracking-wide">{track.id}</p>
            <p className="text-xs text-slate-400 mt-0.5">{track.stationName}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-800/60 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center text-orange-400 mb-0.5"><MdThermostat className="text-sm" /></div>
            <p className="text-xs font-semibold text-white">{track.temperature}°C</p>
            <p className="text-[10px] text-slate-500">Temp</p>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center text-purple-400 mb-0.5"><MdSpeed className="text-sm" /></div>
            <p className="text-xs font-semibold text-white">{track.vibration} g</p>
            <p className="text-[10px] text-slate-500">Vibration</p>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center text-blue-400 mb-0.5"><MdSensors className="text-sm" /></div>
            <p className="text-xs font-semibold text-white">{track.displacement}mm</p>
            <p className="text-[10px] text-slate-500">Disp.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-400"><MdSensors /> Sensor Health</span>
            <span className={`font-semibold ${healthColor}`}>{track.sensorHealth}%</span>
          </div>
          <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${healthBg} transition-all duration-500`} style={{ width: `${track.sensorHealth}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-3">
          <MdAccessTime />
          <span>Updated {fmt(track.lastUpdated)}</span>
        </div>
      </div>
    </div>
  );
}
