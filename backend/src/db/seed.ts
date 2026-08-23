import bcrypt from 'bcryptjs'
import { pathToFileURL } from 'node:url'
import { db, initDatabase } from './index.js'

/**
 * Database seed — matches the live production scheme:
 *   - 12 stations (ST01–ST12)
 *   - admin + Station Incharge / Maintenance Team users per station (password: 12345)
 *   - 5 tracks per station (60 total); ST01 hosts the live ESP32-instrumented tracks
 *   - faults / maintenance tasks / alert logs start EMPTY — they fill up from
 *     real detections via sensor_fusion_dashboard.py and track_simulator.py
 */

const STATIONS = [
  { id: 'ST01', name: 'Dhaka Railway Station', location: 'Dhaka' },
  { id: 'ST02', name: 'Chattogram Railway Station', location: 'Chattogram' },
  { id: 'ST03', name: 'Tongi Junction', location: 'Gazipur' },
  { id: 'ST04', name: 'Akhaura Junction', location: 'Brahmanbaria' },
  { id: 'ST05', name: 'Cumilla Railway Station', location: 'Cumilla' },
  { id: 'ST06', name: 'Mymensingh Railway Station', location: 'Mymensingh' },
  { id: 'ST07', name: 'Sylhet Railway Station', location: 'Sylhet' },
  { id: 'ST08', name: 'Rajshahi Railway Station', location: 'Rajshahi' },
  { id: 'ST09', name: 'Khulna Railway Station', location: 'Khulna' },
  { id: 'ST10', name: 'Rangpur Railway Station', location: 'Rangpur' },
  { id: 'ST11', name: 'Dinajpur Railway Station', location: 'Dinajpur' },
  { id: 'ST12', name: 'Saidpur Railway Station', location: 'Nilphamari' },
]

const DEFAULT_TRACK_IMAGE =
  'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&h=400&fit=crop&auto=format'

// 5 tracks per station: ST01 -> TR-001..TR-005 (TR-001/TR-002 are the live
// ESP32 tracks), ST02 -> TR-006..TR-010, ... sequential across all stations.
function buildTracks(): { id: string; stationId: string }[] {
  const tracks: { id: string; stationId: string }[] = []
  let seq = 1
  for (const s of STATIONS) {
    for (let i = 0; i < 5; i++) {
      tracks.push({ id: `TR-${String(seq).padStart(3, '0')}`, stationId: s.id })
      seq++
    }
  }
  return tracks
}

const TRACKS = buildTracks()

// Login credentials:
//   - railway_administrator: username "admin" / password "admin123"
//   - station_incharge / maintenance_team: Station ID (e.g. ST01) / password "12345"
const DEFAULT_STATION_PASSWORD = '12345'

const NOTIFICATIONS = [
  { title: 'System Ready', message: 'Sensor network initialised on ST01 (Dhaka Railway Station). Live monitoring active.', type: 'info', time: new Date().toISOString(), read: 0 },
]

const DEVICES = [
  { stationId: 'ST01', trackId: 'TR-001', deviceType: 'esp32_sensor_node', name: 'ESP32 Node - Dhaka A', status: 'online', firmwareVersion: 'v1.2.0', location: 'KM 18+120', installedAt: '2026-05-10T09:00:00', lastHeartbeat: null },
  { stationId: 'ST01', trackId: 'TR-002', deviceType: 'esp32_sensor_node', name: 'ESP32 Node - Dhaka B', status: 'online', firmwareVersion: 'v1.2.0', location: 'KM 18+260', installedAt: '2026-05-10T09:00:00', lastHeartbeat: null },
  { stationId: 'ST01', trackId: null, deviceType: 'raspberry_pi_vision', name: 'Pi Vision - Dhaka', status: 'online', firmwareVersion: 'v1.0.4', location: 'Station Yard', installedAt: '2026-05-10T09:00:00', lastHeartbeat: null },
  { stationId: 'ST01', trackId: null, deviceType: 'lora_transmitter', name: 'LoRa TX - Dhaka', status: 'online', firmwareVersion: 'v1.1.0', location: 'Station Yard', installedAt: '2026-05-11T10:00:00', lastHeartbeat: null },
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

    // Stations
    const insertStation = db.prepare(
      'INSERT INTO stations (id, name, location) VALUES (@id, @name, @location)'
    )
    for (const s of STATIONS) insertStation.run(s)

    // Tracks (5 per station, safe defaults — statuses update from live telemetry)
    const insertTrack = db.prepare(
      `INSERT INTO tracks (id, station_id, status, sensor_health, image_url,
                           baseline_distance, baseline_vibration, ir_blocked)
       VALUES (@id, @stationId, 'safe', 100, @imageUrl, 20, 0, 0)`
    )
    for (const t of TRACKS) insertTrack.run({ ...t, imageUrl: DEFAULT_TRACK_IMAGE })

    // Users
    const insertUser = db.prepare(
      'INSERT INTO users (username, password_hash, name, role, email, station_id) VALUES (@username, @hash, @name, @role, @email, @stationId)'
    )
    insertUser.run({
      username: 'admin',
      hash: bcrypt.hashSync('admin123', 10),
      name: 'Md. Rafiqul Islam',
      role: 'railway_administrator',
      email: 'rafiqul.islam@railway.gov.bd',
      stationId: null,
    })
    const stationHash = bcrypt.hashSync(DEFAULT_STATION_PASSWORD, 10)
    for (const s of STATIONS) {
      insertUser.run({
        username: `${s.id}_incharge`,
        hash: stationHash,
        name: `Station Incharge — ${s.name}`,
        role: 'station_incharge',
        email: null,
        stationId: s.id,
      })
      insertUser.run({
        username: `${s.id}_maint`,
        hash: stationHash,
        name: `Maintenance Team — ${s.name}`,
        role: 'maintenance_team',
        email: null,
        stationId: s.id,
      })
    }

    // Notifications (welcome/system only — alerts come from the pipeline)
    const insertNotification = db.prepare(
      'INSERT INTO notifications (title, message, type, time, read) VALUES (@title, @message, @type, @time, @read)'
    )
    for (const n of NOTIFICATIONS) insertNotification.run(n)

    // Devices (live hardware on ST01 only)
    const insertDevice = db.prepare(
      `INSERT INTO devices (station_id, track_id, device_type, name, status, firmware_version, location, installed_at, last_heartbeat)
       VALUES (@stationId, @trackId, @deviceType, @name, @status, @firmwareVersion, @location, @installedAt, @lastHeartbeat)`
    )
    for (const d of DEVICES) insertDevice.run(d)

    // faults / maintenance_tasks / alert_logs intentionally left empty:
    // they populate dynamically from sensor_fusion_dashboard.py detections.
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
