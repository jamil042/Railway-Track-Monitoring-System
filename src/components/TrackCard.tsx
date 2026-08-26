import type { Track, SensorReading } from '../types';
import StatusBadge from './StatusBadge';
import { CAMERA_STREAM_URL } from '../camera';
import { useState } from 'react';
import { MdSensors, MdAccessTime, MdRadar, MdSpeed, MdFullscreen, MdClose } from 'react-icons/md';
import { useData } from '../contexts/DataContext';

interface TrackCardProps {
  track: Track;
  /** Ek somoy matro ekta card MJPEG stream chalay (lag rokkhar jonno). */
  liveCam?: boolean;
}

// track.id / SensorReading.trackId মিলিয়ে, sensorType অনুযায়ী সবচেয়ে সাম্প্রতিক
// reading-এর value বের করে। ESP32 -> sensor_fusion_dashboard.py -> POST
// /api/sensor-readings পাইপলাইন থেকে "vibration" / "displacement" / "ir" sensorType
// আসছে (দেখো sensor_fusion_dashboard.py-এর send_telemetry_to_backend)।
function latestValue(readings: SensorReading[], trackId: string, sensorType: string): number | null {
  const matches = readings.filter(r => r.trackId === trackId && r.sensorType === sensorType);
  if (matches.length === 0) return null;
  const latest = matches.reduce((a, b) =>
    new Date(b.recordedAt).getTime() > new Date(a.recordedAt).getTime() ? b : a
  );
  return latest.value;
}

export default function TrackCard({ track, liveCam = true }: TrackCardProps) {
  const { readings } = useData();
  const [expanded, setExpanded] = useState(false);

  const healthColor = track.sensorHealth >= 85 ? 'text-green-600' : track.sensorHealth >= 60 ? 'text-yellow-600' : 'text-red-600';
  const healthBg = track.sensorHealth >= 85 ? 'bg-green-500' : track.sensorHealth >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });
  };

  // --- Live hardware readings (fallback to backend/track value যদি এখনো কোনো ESP32
  //     telemetry না এসে থাকে, যাতে card খালি না দেখায়) ---
  const liveVibration = latestValue(readings, track.id, 'vibration');
  const liveDisplacement = latestValue(readings, track.id, 'ultrasonic');
  const liveObjectState = latestValue(readings, track.id, 'ir_beam'); // 0 = obstacle/gap, 1 = clear, null = no data yet

  const vibrationDisplay = liveVibration ?? track.vibration;
  const displacementDisplay = liveDisplacement ?? track.displacement;

  const objectDetected = liveObjectState === 0;
  const objectLabel = liveObjectState === null ? '—' : objectDetected ? 'OBSTACLE' : 'CLEAR';

  // Live camera stream shudhu hardware-instrumented track gulo te dekhai —
  // prottek station er prothonom track (TR-001, TR-006, TR-011, ...).
  // Protita card e MJPEG stream khulle browser/camera server duto-i lag kore.
  const seq = parseInt(track.id.replace('TR-', ''), 10);
  const isLiveCamTrack = liveCam !== false && Number.isFinite(seq) && seq % 5 === 1;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
      <div className="relative h-36 bg-black overflow-hidden">
        <img
          src={isLiveCamTrack ? CAMERA_STREAM_URL : track.imageUrl}
          alt={`Track ${track.id} live camera (YOLO detection)`}
          className={`w-full h-full ${isLiveCamTrack ? 'object-cover' : 'object-cover opacity-90'}`}
          onError={(e) => {
            // camera_stream.py bondho thakle track-er placeholder snapshot dekhao
            (e.target as HTMLImageElement).src = track.imageUrl;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={track.status} />
        </div>
        {isLiveCamTrack && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-white font-mono">LIVE CAM</span>
          </div>
        )}
        {/* Boro kore dekhar button — click korle fullscreen modal-e stream dekhabe */}
        {isLiveCamTrack && (
          <button
            onClick={() => setExpanded(true)}
            title="View full screen"
            className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-black/60 hover:bg-blue-600 backdrop-blur-sm px-2.5 py-1 rounded-md text-white text-xs font-medium transition-all"
          >
            <MdFullscreen className="text-base" /> Expand
          </button>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-slate-900 font-mono tracking-wide">{track.id}</p>
            <p className="text-xs text-slate-500 mt-0.5">{track.stationName}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* আগে এখানে "Temp" ছিল — কোনো temperature sensor না থাকায় এখন IR sensor
              এর object/obstacle detection status দেখানো হচ্ছে */}
          <div className={`border rounded-lg p-2 text-center ${objectDetected ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
            <div className={`flex items-center justify-center mb-0.5 ${objectDetected ? 'text-red-500' : 'text-orange-500'}`}>
              <MdRadar className="text-sm" />
            </div>
            <p className="text-xs font-semibold text-slate-800">{objectLabel}</p>
            <p className="text-[10px] text-slate-400">Object</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center text-purple-500 mb-0.5"><MdSpeed className="text-sm" /></div>
            {/* SW-420 আসলে digital pulse count দেয়, physical g-force না — তাই unit
                "count" এ ঠিক করা হয়েছে (আগে ভুলভাবে "g" লেখা ছিল) */}
            <p className="text-xs font-semibold text-slate-800">{vibrationDisplay}</p>
            <p className="text-[10px] text-slate-400">Vibration</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center text-blue-500 mb-0.5"><MdSensors className="text-sm" /></div>
            <p className="text-xs font-semibold text-slate-800">{displacementDisplay != null ? `${displacementDisplay}cm` : '—'}</p>
            <p className="text-[10px] text-slate-400">Distance</p>
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

      {/* Fullscreen live camera modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-white font-mono tracking-wide">
                  {track.id} — LIVE CAMERA (YOLO Detection)
                </span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-white/70 hover:text-white transition-colors"
                title="Close"
              >
                <MdClose className="text-2xl" />
              </button>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0">
              <img
                src={CAMERA_STREAM_URL}
                alt={`Track ${track.id} full screen camera`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = track.imageUrl;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}