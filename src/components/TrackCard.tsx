import type { Track, SensorReading } from '../types';
import StatusBadge from './StatusBadge';
import { MdSensors, MdAccessTime, MdRadar, MdSpeed } from 'react-icons/md';
import { useData } from '../contexts/DataContext';

interface TrackCardProps {
  track: Track;
}

function latestValue(readings: SensorReading[], trackId: string, sensorType: string): number | null {
  const matches = readings.filter(r => r.trackId === trackId && r.sensorType === sensorType);
  if (matches.length === 0) return null;
  const latest = matches.reduce((a, b) =>
    new Date(b.recordedAt).getTime() > new Date(a.recordedAt).getTime() ? b : a
  );
  return latest.value;
}

export default function TrackCard({ track }: TrackCardProps) {
  const { readings } = useData();

  const healthColor = track.sensorHealth >= 85 ? 'text-green-600' : track.sensorHealth >= 60 ? 'text-yellow-600' : 'text-red-600';
  const healthBg = track.sensorHealth >= 85 ? 'bg-green-500' : track.sensorHealth >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });
  };

  const liveVibration = latestValue(readings, track.id, 'vibration');
  const liveDisplacement = latestValue(readings, track.id, 'displacement');
  const liveObjectState = latestValue(readings, track.id, 'ir');

  const vibrationDisplay = liveVibration ?? track.vibration;
  const displacementDisplay = liveDisplacement ?? track.displacement;

  const objectDetected = liveObjectState === 0;
  const objectLabel = liveObjectState === null ? '—' : objectDetected ? 'OBSTACLE' : 'CLEAR';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
      <div className="relative h-36 bg-slate-100 overflow-hidden">
        <img
          src={track.imageUrl}
          alt={`Track ${track.id} camera snapshot`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={track.status} />
        </div>
        <div className="absolute bottom-2.5 right-2.5 text-xs text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md font-mono">
          LIVE CAM
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-slate-900 font-mono tracking-wide">{track.id}</p>
            <p className="text-xs text-slate-500 mt-0.5">{track.stationName}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className={`border rounded-lg p-2 text-center ${objectDetected ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
            <div className={`flex items-center justify-center mb-0.5 ${objectDetected ? 'text-red-500' : 'text-orange-500'}`}>
              <MdRadar className="text-sm" />
            </div>
            <p className="text-xs font-semibold text-slate-800">{objectLabel}</p>
            <p className="text-[10px] text-slate-400">Object</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center text-purple-500 mb-0.5"><MdSpeed className="text-sm" /></div>
            <p className="text-xs font-semibold text-slate-800">{vibrationDisplay}</p>
            <p className="text-[10px] text-slate-400">Vibration</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center text-blue-500 mb-0.5"><MdSensors className="text-sm" /></div>
            <p className="text-xs font-semibold text-slate-800">{displacementDisplay}mm</p>
            <p className="text-[10px] text-slate-400">Disp.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-500"><MdSensors /> Sensor Health</span>
            <span className={`font-semibold ${healthColor}`}>{track.sensorHealth}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${healthBg} transition-all duration-500`} style={{ width: `${track.sensorHealth}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3">
          <MdAccessTime />
          <span>Updated {fmt(track.lastUpdated)}</span>
        </div>
      </div>
    </div>
  );
}