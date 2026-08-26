import bcrypt from 'bcryptjs'
import { pathToFileURL } from 'node:url'
import { COL, firestore, setCounter } from './index.js'

/**
 * Database seed — matches the live production scheme:
 *   - 12 stations (ST01–ST12)
 *   - admin + Station Incharge / Maintenance Team users per station (password: 12345)
 *   - 5 tracks per station (60 total); ST01 hosts the live ESP32-instrumented tracks
 *   - faults / maintenance tasks / alert logs start EMPTY
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

function buildTracks(): { id: string; stationId: string; stationName: string }[] {
  const tracks: { id: string; stationId: string; stationName: string }[] = []
  let seq = 1
  for (const s of STATIONS) {
    for (let i = 0; i < 5; i++) {
      tracks.push({ id: `TR-${String(seq).padStart(3, '0')}`, stationId: s.id, stationName: s.name })
      seq++
    }
  }
  return tracks
}

const TRACKS = buildTracks()

const DEFAULT_STATION_PASSWORD = '12345'

const NOTIFICATIONS = [
  { title: 'System Ready', message: 'Sensor network initialised on ST01 (Dhaka Railway Station). Live monitoring active.', type: 'info', time: new Date().toISOString(), read: false },
]

const DEVICES = [
  { stationId: 'ST01', trackId: 'TR-001', deviceType: 'esp32_sensor_node', name: 'ESP32 Node - Dhaka A', status: 'online', firmwareVersion: 'v1.2.0', location: 'KM 18+120', installedAt: '2026-05-10T09:00:00', lastHeartbeat: null },
  { stationId: 'ST01', trackId: 'TR-002', deviceType: 'esp32_sensor_node', name: 'ESP32 Node - Dhaka B', status: 'online', firmwareVersion: 'v1.2.0', location: 'KM 18+260', installedAt: '2026-05-10T09:00:00', lastHeartbeat: null },
  { stationId: 'ST01', trackId: null, deviceType: 'raspberry_pi_vision', name: 'Pi Vision - Dhaka', status: 'online', firmwareVersion: 'v1.0.4', location: 'Station Yard', installedAt: '2026-05-10T09:00:00', lastHeartbeat: null },
  { stationId: 'ST01', trackId: null, deviceType: 'lora_transmitter', name: 'LoRa TX - Dhaka', status: 'online', firmwareVersion: 'v1.1.0', location: 'Station Yard', installedAt: '2026-05-11T10:00:00', lastHeartbeat: null },
]

async function wipeCollection(name: string): Promise<void> {
  const snap = await firestore.collection(name).get()
  const batch = firestore.batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

export async function seedDatabase(options: { force?: boolean } = {}): Promise<void> {
  const { force = false } = options

  const userCount = (await firestore.collection(COL.users).count().get()).data().count
  if (userCount > 0 && !force) return

  for (const col of [
    COL.sensorReadings,
    COL.alertLogs,
    COL.maintenanceTasks,
    COL.notifications,
    COL.faults,
    COL.devices,
    COL.tracks,
    COL.users,
    COL.stations,
  ]) {
    await wipeCollection(col)
  }

  // Stations
  for (const s of STATIONS) {
    await firestore.collection(COL.stations).doc(s.id).set({
      name: s.name,
      location: s.location,
      totalTracks: 5,
      status: 'safe',
    })
  }

  // Tracks (5 per station, safe defaults — statuses update from live telemetry)
  for (const t of TRACKS) {
    await firestore.collection(COL.tracks).doc(t.id).set({
      stationId: t.stationId,
      stationName: t.stationName,
      status: 'safe',
      sensorHealth: 100,
      imageUrl: DEFAULT_TRACK_IMAGE,
      temperature: null,
      vibration: null,
      displacement: null,
      baselineDistance: 20,
      baselineVibration: 0,
      irBlocked: 0,
      readingsUpdatedAt: null,
    })
  }

  // Users (doc id = numeric string, mirrors the old AUTOINCREMENT ids)
  let userSeq = 0
  const insertUser = async (u: {
    username: string
    hash: string
    name: string
    role: string
    email: string | null
    stationId: string | null
  }) => {
    userSeq++
    await firestore.collection(COL.users).doc(String(userSeq)).set({
      username: u.username,
      passwordHash: u.hash,
      name: u.name,
      role: u.role,
      email: u.email,
      avatar: null,
      stationId: u.stationId,
    })
  }

  await insertUser({
    username: 'admin',
    hash: bcrypt.hashSync('admin123', 10),
    name: 'Md. Rafiqul Islam',
    role: 'railway_administrator',
    email: 'rafiqul.islam@railway.gov.bd',
    stationId: null,
  })
  const stationHash = bcrypt.hashSync(DEFAULT_STATION_PASSWORD, 10)
  for (const s of STATIONS) {
    await insertUser({
      username: `${s.id}_incharge`,
      hash: stationHash,
      name: `Station Incharge — ${s.name}`,
      role: 'station_incharge',
      email: null,
      stationId: s.id,
    })
    await insertUser({
      username: `${s.id}_maint`,
      hash: stationHash,
      name: `Maintenance Team — ${s.name}`,
      role: 'maintenance_team',
      email: null,
      stationId: s.id,
    })
  }
  await setCounter(COL.users, userSeq)

  // Notifications (welcome/system only — alerts come from the pipeline)
  let notifSeq = 0
  for (const n of NOTIFICATIONS) {
    notifSeq++
    await firestore.collection(COL.notifications).doc(String(notifSeq)).set(n)
  }
  await setCounter(COL.notifications, notifSeq)

  // Devices (live hardware on ST01 only)
  let deviceSeq = 0
  for (const d of DEVICES) {
    deviceSeq++
    await firestore.collection(COL.devices).doc(String(deviceSeq)).set(d)
  }
  await setCounter(COL.devices, deviceSeq)

  await setCounter(COL.sensorReadings, 0)
  await setCounter(COL.alertLogs, 0)

  // faults / maintenance_tasks intentionally left empty:
  // they populate dynamically from detections.
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase({ force: true })
    .then(async () => {
      for (const col of [COL.stations, COL.tracks, COL.users, COL.notifications, COL.devices, COL.faults]) {
        const n = (await firestore.collection(col).count().get()).data().count
        console.log(`${col}: ${n}`)
      }
      console.log('Seed complete.')
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
