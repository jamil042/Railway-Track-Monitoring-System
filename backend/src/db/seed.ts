import bcrypt from 'bcryptjs'
import { pathToFileURL } from 'node:url'
import { db, initDatabase } from './index.js'

interface TrackSeed {
  id: string
  stationId: string
  status: string
  sensorHealth: number
  lastUpdated: string
  imageUrl: string
  temperature: number
  vibration: number
  displacement: number
}

interface FaultSeed {
  id: string
  stationId: string
  trackId: string
  faultType: string
  severity: string
  detectionTime: string
  status: string
  imageUrl: string
  aiConfidence: number
  sensorValues: { temperature: number; vibration: number; displacement: number; pressure: number }
  remarks: string
  description: string
}

const STATIONS = [
  { id: 'st1', name: 'Kamalapur Railway Station', location: 'Dhaka', totalTracks: 22, status: 'warning' },
  { id: 'st2', name: 'Chattogram Central', location: 'Chattogram', totalTracks: 18, status: 'warning' },
  { id: 'st3', name: 'Rajshahi Junction', location: 'Rajshahi', totalTracks: 14, status: 'safe' },
  { id: 'st4', name: 'Khulna Railway Station', location: 'Khulna', totalTracks: 20, status: 'critical' },
  { id: 'st5', name: 'Sylhet Junction', location: 'Sylhet', totalTracks: 12, status: 'safe' },
  { id: 'st6', name: 'Mymensingh Station', location: 'Mymensingh', totalTracks: 10, status: 'warning' },
  { id: 'st7', name: 'Comilla Railway Station', location: 'Comilla', totalTracks: 8, status: 'warning' },
  { id: 'st8', name: 'Rangpur Junction', location: 'Rangpur', totalTracks: 8, status: 'safe' },
]

const TRACKS: TrackSeed[] = [
  { id: 'TR-001', stationId: 'st1', status: 'critical', sensorHealth: 62, lastUpdated: '2026-07-22T08:34:00', imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=400&h=250&fit=crop&auto=format', temperature: 78.4, vibration: 9.2, displacement: 4.1 },
  { id: 'TR-002', stationId: 'st1', status: 'warning', sensorHealth: 81, lastUpdated: '2026-07-22T08:30:00', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop&auto=format', temperature: 65.1, vibration: 6.4, displacement: 2.3 },
  { id: 'TR-003', stationId: 'st2', status: 'safe', sensorHealth: 97, lastUpdated: '2026-07-22T08:31:00', imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=250&fit=crop&auto=format', temperature: 52.3, vibration: 3.1, displacement: 0.8 },
  { id: 'TR-004', stationId: 'st4', status: 'critical', sensorHealth: 45, lastUpdated: '2026-07-22T08:28:00', imageUrl: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=250&fit=crop&auto=format', temperature: 89.7, vibration: 11.3, displacement: 6.2 },
  { id: 'TR-005', stationId: 'st3', status: 'safe', sensorHealth: 99, lastUpdated: '2026-07-22T08:35:00', imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=400&h=250&fit=crop&auto=format', temperature: 48.9, vibration: 2.4, displacement: 0.5 },
  { id: 'TR-006', stationId: 'st4', status: 'warning', sensorHealth: 73, lastUpdated: '2026-07-22T08:27:00', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop&auto=format', temperature: 67.2, vibration: 7.1, displacement: 3.0 },
  { id: 'TR-007', stationId: 'st5', status: 'safe', sensorHealth: 95, lastUpdated: '2026-07-22T08:36:00', imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=250&fit=crop&auto=format', temperature: 44.0, vibration: 1.9, displacement: 0.3 },
  { id: 'TR-008', stationId: 'st6', status: 'warning', sensorHealth: 79, lastUpdated: '2026-07-22T08:33:00', imageUrl: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=250&fit=crop&auto=format', temperature: 61.5, vibration: 5.8, displacement: 2.1 },
  { id: 'TR-009', stationId: 'st7', status: 'safe', sensorHealth: 93, lastUpdated: '2026-07-22T08:32:00', imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=400&h=250&fit=crop&auto=format', temperature: 50.2, vibration: 2.8, displacement: 0.6 },
  { id: 'TR-010', stationId: 'st8', status: 'safe', sensorHealth: 98, lastUpdated: '2026-07-22T08:37:00', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop&auto=format', temperature: 46.7, vibration: 2.0, displacement: 0.4 },
  { id: 'TR-011', stationId: 'st4', status: 'critical', sensorHealth: 38, lastUpdated: '2026-07-22T08:20:00', imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=250&fit=crop&auto=format', temperature: 94.3, vibration: 13.7, displacement: 7.5 },
  { id: 'TR-012', stationId: 'st2', status: 'warning', sensorHealth: 77, lastUpdated: '2026-07-22T08:29:00', imageUrl: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=250&fit=crop&auto=format', temperature: 58.9, vibration: 5.1, displacement: 1.8 },
]

const FAULTS: FaultSeed[] = [
  { id: 'FLT-2026-001', stationId: 'st4', trackId: 'TR-011', faultType: 'Rail Fracture', severity: 'critical', detectionTime: '2026-07-22T07:14:22', status: 'active', imageUrl: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&h=400&fit=crop&auto=format', aiConfidence: 97.4, sensorValues: { temperature: 94.3, vibration: 13.7, displacement: 7.5, pressure: 142.8 }, remarks: 'Complete fracture detected at rail joint. Immediate shutdown recommended.', description: 'AI model detected a complete transverse rail fracture at track joint KM 22+450. Structural integrity compromised.' },
  { id: 'FLT-2026-002', stationId: 'st1', trackId: 'TR-001', faultType: 'Track Misalignment', severity: 'critical', detectionTime: '2026-07-22T06:52:10', status: 'under_maintenance', imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&h=400&fit=crop&auto=format', aiConfidence: 93.1, sensorValues: { temperature: 78.4, vibration: 9.2, displacement: 4.1, pressure: 118.3 }, remarks: 'Lateral displacement exceeds safety threshold. Maintenance team dispatched.', description: 'Track lateral displacement of 4.1mm detected at KM 18+120. Exceeds 3.5mm safety threshold.' },
  { id: 'FLT-2026-003', stationId: 'st4', trackId: 'TR-004', faultType: 'Weld Crack', severity: 'high', detectionTime: '2026-07-22T05:31:45', status: 'under_maintenance', imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&h=400&fit=crop&auto=format', aiConfidence: 88.6, sensorValues: { temperature: 89.7, vibration: 11.3, displacement: 6.2, pressure: 135.0 }, remarks: 'Weld crack propagating. Speed restriction imposed to 30 km/h.', description: 'Longitudinal weld crack of approx. 18cm detected at KM 09+670. Crack propagation risk is high.' },
  { id: 'FLT-2026-004', stationId: 'st1', trackId: 'TR-002', faultType: 'Ballast Erosion', severity: 'medium', detectionTime: '2026-07-22T04:18:30', status: 'active', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&auto=format', aiConfidence: 82.3, sensorValues: { temperature: 65.1, vibration: 6.4, displacement: 2.3, pressure: 98.5 }, remarks: 'Ballast degradation detected. Scheduled for maintenance within 48 hours.', description: 'Significant ballast erosion detected over 12m section at KM 31+880. Track settlement risk increasing.' },
  { id: 'FLT-2026-005', stationId: 'st6', trackId: 'TR-008', faultType: 'Rail Wear', severity: 'medium', detectionTime: '2026-07-21T22:40:15', status: 'active', imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&h=400&fit=crop&auto=format', aiConfidence: 79.8, sensorValues: { temperature: 61.5, vibration: 5.8, displacement: 2.1, pressure: 105.2 }, remarks: 'Lateral wear within permissible limit. Monitor closely.', description: 'Accelerated lateral wear detected on high-rail at curved section KM 7+230.' },
  { id: 'FLT-2026-006', stationId: 'st2', trackId: 'TR-012', faultType: 'Joint Gap Excess', severity: 'low', detectionTime: '2026-07-21T19:15:00', status: 'fixed', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&auto=format', aiConfidence: 91.2, sensorValues: { temperature: 58.9, vibration: 5.1, displacement: 1.8, pressure: 96.7 }, remarks: 'Joint gap adjusted. Track cleared for normal operations.', description: 'Rail joint gap measured at 28mm, exceeding summer limit of 25mm at KM 15+540.' },
  { id: 'FLT-2026-007', stationId: 'st4', trackId: 'TR-006', faultType: 'Corrugation', severity: 'medium', detectionTime: '2026-07-21T16:22:33', status: 'under_maintenance', imageUrl: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&h=400&fit=crop&auto=format', aiConfidence: 85.5, sensorValues: { temperature: 67.2, vibration: 7.1, displacement: 3.0, pressure: 108.4 }, remarks: 'Rail grinding scheduled. Temporary speed restriction applied.', description: 'Short-pitch rail corrugation (wavelength ~30mm) detected at KM 4+110.' },
  { id: 'FLT-2026-008', stationId: 'st7', trackId: 'TR-009', faultType: 'Spike Failure', severity: 'low', detectionTime: '2026-07-21T11:05:44', status: 'fixed', imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&h=400&fit=crop&auto=format', aiConfidence: 76.9, sensorValues: { temperature: 50.2, vibration: 2.8, displacement: 0.6, pressure: 88.1 }, remarks: 'Spikes replaced. Track inspection passed.', description: 'Multiple missing/broken track spikes detected in 8m section at KM 22+750.' },
]

const MAINTENANCE = [
  { id: 'MNT-001', faultId: 'FLT-2026-002', trackId: 'TR-001', assignedTeam: 'Alpha Team', engineer: 'Md. Shahadat Hossain', progress: 65, status: 'in_progress', startTime: '2026-07-22T07:30:00', completionTime: '2026-07-22T12:00:00' },
  { id: 'MNT-002', faultId: 'FLT-2026-003', trackId: 'TR-004', assignedTeam: 'Beta Team', engineer: 'Nasrin Sultana', progress: 40, status: 'in_progress', startTime: '2026-07-22T06:00:00', completionTime: '2026-07-22T14:00:00' },
  { id: 'MNT-003', faultId: 'FLT-2026-007', trackId: 'TR-006', assignedTeam: 'Gamma Team', engineer: 'Md. Rezaul Karim', progress: 20, status: 'in_progress', startTime: '2026-07-22T09:00:00', completionTime: '2026-07-22T18:00:00' },
  { id: 'MNT-004', faultId: 'FLT-2026-001', trackId: 'TR-011', assignedTeam: 'Delta Team', engineer: 'Shamima Akter', progress: 0, status: 'pending', completionTime: '2026-07-22T20:00:00' },
  { id: 'MNT-005', faultId: 'FLT-2026-006', trackId: 'TR-012', assignedTeam: 'Epsilon Team', engineer: 'Abdullah Al Mamun', progress: 100, status: 'completed', startTime: '2026-07-21T20:00:00', completionTime: '2026-07-21T23:45:00' },
  { id: 'MNT-006', faultId: 'FLT-2026-008', trackId: 'TR-009', assignedTeam: 'Zeta Team', engineer: 'Roksana Khanam', progress: 100, status: 'completed', startTime: '2026-07-21T12:00:00', completionTime: '2026-07-21T15:30:00' },
]

const NOTIFICATIONS = [
  { title: 'Critical Fault Detected', message: 'Rail fracture detected on TR-011 at Khulna Railway Station. Immediate action required.', type: 'critical', time: '2026-07-22T07:14:22', read: 0 },
  { title: 'Maintenance Update', message: 'Track misalignment repair on TR-001 is 65% complete.', type: 'info', time: '2026-07-22T06:50:00', read: 0 },
  { title: 'Fault Resolved', message: 'Joint gap excess on TR-012 at Chattogram Central has been fixed.', type: 'success', time: '2026-07-21T23:45:00', read: 1 },
  { title: 'Warning: High Vibration', message: 'Vibration levels on TR-004 approaching critical threshold.', type: 'warning', time: '2026-07-22T05:00:00', read: 0 },
  { title: 'System Health Check', message: 'All sensor systems operating normally. 94% network uptime.', type: 'info', time: '2026-07-22T04:00:00', read: 1 },
]

const USERS = [
  { username: 'admin', password: 'admin123', name: 'Md. Rafiqul Islam', role: 'railway_administrator', email: 'rafiqul.islam@railway.gov.bd', stationId: null },
  { username: 'incharge', password: 'incharge123', name: 'Fatema Begum', role: 'station_incharge', email: 'fatema.begum@railway.gov.bd', stationId: 'st1' },
  { username: 'maintenance', password: 'maint123', name: 'Abul Kalam Azad', role: 'maintenance_team', email: 'abul.azad@railway.gov.bd', stationId: 'st2' },
]

const DEVICES = [
  { stationId: 'st1', trackId: 'TR-001', deviceType: 'esp32_sensor_node', name: 'ESP32 Node - Kamalapur A', status: 'online', firmwareVersion: 'v1.2.0', location: 'KM 18+120', installedAt: '2026-05-10T09:00:00', lastHeartbeat: '2026-07-22T08:34:00' },
  { stationId: 'st1', trackId: null, deviceType: 'raspberry_pi_vision', name: 'Pi Vision - Kamalapur', status: 'online', firmwareVersion: 'v1.0.4', location: 'Station Yard', installedAt: '2026-05-10T09:00:00', lastHeartbeat: '2026-07-22T08:33:00' },
  { stationId: 'st1', trackId: null, deviceType: 'lora_transmitter', name: 'LoRa TX - Kamalapur', status: 'online', firmwareVersion: 'v1.1.0', location: 'Station Yard', installedAt: '2026-05-11T10:00:00', lastHeartbeat: '2026-07-22T08:34:00' },
  { stationId: 'st1', trackId: null, deviceType: 'lora_receiver_station', name: 'LoRa RX - Station Display', status: 'online', firmwareVersion: 'v1.1.0', location: 'Control Room', installedAt: '2026-05-11T10:00:00', lastHeartbeat: '2026-07-22T08:34:00' },
  { stationId: 'st4', trackId: 'TR-011', deviceType: 'esp32_sensor_node', name: 'ESP32 Node - Khulna A', status: 'degraded', firmwareVersion: 'v1.2.0', location: 'KM 22+450', installedAt: '2026-06-01T08:00:00', lastHeartbeat: '2026-07-22T08:20:00' },
  { stationId: 'st4', trackId: null, deviceType: 'train_unit', name: 'Train Unit - Khulna Line', status: 'online', firmwareVersion: 'v1.0.1', location: 'En route', installedAt: '2026-06-01T08:00:00', lastHeartbeat: '2026-07-22T08:35:00' },
]

export function seedDatabase(options: { force?: boolean } = {}): void {
  initDatabase()
  const { force = false } = options

  const userCount = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  if (userCount > 0 && !force) return

  const truncate = db.transaction(() => {
    db.exec(`
      DELETE FROM sensor_readings;
      DELETE FROM alert_logs;
      DELETE FROM maintenance_tasks;
      DELETE FROM notifications;
      DELETE FROM faults;
      DELETE FROM devices;
      DELETE FROM tracks;
      DELETE FROM users;
      DELETE FROM stations;
      DELETE FROM sqlite_sequence;
    `)
  })

  const seed = db.transaction(() => {
    truncate()

    const insertStation = db.prepare(
      'INSERT INTO stations (id, name, location, total_tracks, status) VALUES (@id, @name, @location, @totalTracks, @status)'
    )
    for (const s of STATIONS) insertStation.run({ ...s, totalTracks: s.totalTracks })

    const insertTrack = db.prepare(
      `INSERT INTO tracks (id, station_id, status, sensor_health, image_url, temperature, vibration, displacement, readings_updated_at)
       VALUES (@id, @stationId, @status, @sensorHealth, @imageUrl, @temperature, @vibration, @displacement, @lastUpdated)`
    )
    for (const t of TRACKS) insertTrack.run(t)

    const insertUser = db.prepare(
      'INSERT INTO users (username, password_hash, name, role, email, station_id) VALUES (@username, @hash, @name, @role, @email, @stationId)'
    )
    for (const u of USERS) insertUser.run({ ...u, hash: bcrypt.hashSync(u.password, 10) })

    const insertFault = db.prepare(
      `INSERT INTO faults (id, station_id, track_id, fault_type, severity, detection_time, status, image_url, ai_confidence, sensor_values, remarks, description)
       VALUES (@id, @stationId, @trackId, @faultType, @severity, @detectionTime, @status, @imageUrl, @aiConfidence, @sensorValues, @remarks, @description)`
    )
    for (const f of FAULTS) insertFault.run({ ...f, sensorValues: JSON.stringify(f.sensorValues) })

    const insertTask = db.prepare(
      `INSERT INTO maintenance_tasks (id, fault_id, track_id, assigned_team, engineer, progress, status, start_time, completion_time)
       VALUES (@id, @faultId, @trackId, @assignedTeam, @engineer, @progress, @status, @startTime, @completionTime)`
    )
    for (const m of MAINTENANCE) insertTask.run({ ...m, startTime: m.startTime ?? null, completionTime: m.completionTime ?? null })

    const insertNotification = db.prepare(
      'INSERT INTO notifications (title, message, type, time, read) VALUES (@title, @message, @type, @time, @read)'
    )
    for (const n of NOTIFICATIONS) insertNotification.run(n)

    const insertDevice = db.prepare(
      `INSERT INTO devices (station_id, track_id, device_type, name, status, firmware_version, location, installed_at, last_heartbeat)
       VALUES (@stationId, @trackId, @deviceType, @name, @status, @firmwareVersion, @location, @installedAt, @lastHeartbeat)`
    )
    for (const d of DEVICES) insertDevice.run(d)

    const espNodeId = 1
    const insertReading = db.prepare(
      'INSERT INTO sensor_readings (device_id, track_id, sensor_type, value, unit, recorded_at) VALUES (@deviceId, @trackId, @sensorType, @value, @unit, @recordedAt)'
    )
    for (const t of TRACKS) {
      const when = t.lastUpdated
      insertReading.run({ deviceId: espNodeId, trackId: t.id, sensorType: 'temperature', value: t.temperature, unit: 'C', recordedAt: when })
      insertReading.run({ deviceId: espNodeId, trackId: t.id, sensorType: 'vibration', value: t.vibration, unit: 'mm/s', recordedAt: when })
      insertReading.run({ deviceId: espNodeId, trackId: t.id, sensorType: 'ultrasonic', value: t.displacement, unit: 'mm', recordedAt: when })
    }

    const insertAlert = db.prepare(
      `INSERT INTO alert_logs (fault_id, destination, channel, message, severity, sent_at)
       VALUES (@faultId, @destination, 'lora', @message, @severity, @sentAt)`
    )
    const alertMessages: Record<string, string> = {
      'FLT-2026-001': 'CRITICAL: Rail Fracture detected on TR-011. Train must stop.',
      'FLT-2026-002': 'WARNING: Track misalignment on TR-001. Maintenance dispatched.',
      'FLT-2026-003': 'HIGH: Weld crack propagating on TR-004. Speed restricted to 30 km/h.',
    }
    for (const fault of FAULTS) {
      if (!alertMessages[fault.id]) continue
      const stationAlert = { faultId: fault.id, destination: 'station_display', message: alertMessages[fault.id], severity: fault.severity, sentAt: fault.detectionTime }
      insertAlert.run(stationAlert)
      if (fault.severity === 'critical') {
        insertAlert.run({ faultId: fault.id, destination: 'train_unit', message: alertMessages[fault.id], severity: fault.severity, sentAt: fault.detectionTime })
      }
    }
  })

  seed()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase({ force: true })
  const counts = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]
  for (const { name } of counts) {
    const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get() as { n: number }
    console.log(`${name}: ${n}`)
  }
  console.log('Seed complete.')
}