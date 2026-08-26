import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore } from '../db/index.js'
import { MAX_READINGS_PER_TRACK, PATHS, rtdb } from '../db/rtdb.js'
import type { SensorReading } from '../types/index.js'

export interface ReadingFilters {
  deviceId?: number
  trackId?: string
  sensorType?: string
  stationId?: string
  limit?: number
}

/**
 * HOT CACHE — RTDB asia-southeast1 e ase (internet round-trip ~200ms+/op),
 * tai shob read memory theke instant hoy. Writes memory update kore
 * background-e asynchronously RTDB te persist kore (data haray na).
 */

const memLatest = new Map<string, SensorReading>()
const memHistory = new Map<string, SensorReading[]>() // per track, newest FIRST
const memLive = new Map<string, Record<string, unknown>>()
let hydrated = false

function key(deviceId: number, trackId: string, sensorType: string): string {
  return `${deviceId}_${trackId}_${sensorType}`
}

export async function hydrateTelemetryCache(): Promise<void> {
  if (hydrated) return
  hydrated = true
  try {
    const [latestSnap, histSnap, liveSnap] = await Promise.all([
      rtdb.ref(PATHS.latest).get(),
      rtdb.ref(PATHS.history).get(),
      rtdb.ref(PATHS.live).get(),
    ])
    for (const v of Object.values((latestSnap.val() ?? {}) as Record<string, SensorReading>)) {
      if (v?.trackId && v.sensorType) memLatest.set(key(v.deviceId!, v.trackId, v.sensorType), v)
    }
    const hist = (histSnap.val() ?? {}) as Record<string, Record<string, SensorReading>>
    for (const [tid, entries] of Object.entries(hist)) {
      const arr = Object.values(entries ?? {})
        .filter((r) => r?.recordedAt)
        .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))
      memHistory.set(tid, arr.slice(0, MAX_READINGS_PER_TRACK))
    }
    const live = (liveSnap.val() ?? {}) as Record<string, Record<string, unknown>>
    for (const [tid, v] of Object.entries(live)) memLive.set(tid, v)
    console.log(`[CACHE] Telemetry hydrated: ${memLatest.size} latest, ${memLive.size} live nodes`)
  } catch (e) {
    console.error('[CACHE] hydration failed (will retry on next ingest):', String(e).slice(0, 120))
    hydrated = false
  }
}

/** Live overlay for tracks.service — memory theke, zero latency. */
export function getAllLiveOverlay(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(memLive)
}

export function listReadings(filters: ReadingFilters = {}): SensorReading[] {
  let readings: SensorReading[]

  if (filters.trackId) {
    readings = [...(memHistory.get(filters.trackId) ?? [])]
  } else {
    readings = [...memLatest.values()]
  }

  if (filters.stationId || filters.deviceId !== undefined || filters.sensorType) {
    // Station scope: filter using the cached track->station mapping.
    if (filters.stationId) {
      const ids = stationTracks.get(filters.stationId) ?? new Set<string>()
      readings = readings.filter((r) => r.trackId && ids.has(r.trackId))
    }
    if (filters.deviceId !== undefined) readings = readings.filter((r) => r.deviceId === filters.deviceId)
    if (filters.sensorType) readings = readings.filter((r) => r.sensorType === filters.sensorType)
  }

  readings.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))
  return readings.slice(0, Math.min(filters.limit ?? 100, 1000))
}

/** trackId -> stationId mapping cache, refreshed lazily by routes layer. */
export const stationTracks = new Map<string, Set<string>>()

export function rememberStationTracks(stationId: string, ids: string[]): void {
  stationTracks.set(stationId, new Set(ids))
}

export async function getReading(id: number): Promise<SensorReading> {
  throw new ApiError(404, `Reading #${id} not found`)
}

/**
 * Ingest a telemetry point (the endpoint ESP32 / Raspberry Pi nodes push to).
 * Memory-first: instant response. Persistence to RTDB happens in background.
 */
export function createReading(data: Partial<SensorReading>): SensorReading {
  const deviceId = data.deviceId
  if (!deviceId) throw new ApiError(400, 'deviceId is required')
  if (!data.sensorType) throw new ApiError(400, 'sensorType is required')

  const recordedAt = data.recordedAt ?? new Date().toISOString()
  const reading: SensorReading = {
    id: Date.now(),
    deviceId,
    trackId: data.trackId ?? null,
    sensorType: data.sensorType,
    value: data.value ?? 0,
    unit: data.unit ?? null,
    recordedAt,
  } as unknown as SensorReading

  if (!data.trackId) return reading

  void hydrateTelemetryCache().then(() => {
    const trackId = data.trackId as string
    const sensorType = data.sensorType as string
    // 1. Hot caches (instant reads for all polls)
    memLatest.set(key(deviceId, trackId, sensorType), reading)
    const hist = memHistory.get(trackId) ?? []
    hist.unshift(reading)
    // Cap: purano entries memory theke beriye jay; queueHistorySync puro
    // node rewrite kore (max 50), tai alada delete lagbe na.
    if (hist.length > MAX_READINGS_PER_TRACK) hist.splice(MAX_READINGS_PER_TRACK)

    // 2. Recompute live values/status in memory
    applyTrackTrigger(trackId, sensorType, Number(data.value ?? 0), recordedAt)

    // 3. Background persistence to RTDB (never blocks the response)
    void rtdb.ref(PATHS.latest).child(key(deviceId, trackId, sensorType)).set({ ...reading })
      .catch((e) => console.error('[RTDB] latest persist:', String(e).slice(0, 100)))
    queueHistorySync(trackId)
  })

  return reading
}

/** Debounced full-node history sync per track (1 write replaces many). */
const historySyncTimers = new Map<string, ReturnType<typeof setTimeout>>()
function queueHistorySync(trackId: string): void {
  if (historySyncTimers.has(trackId)) return
  historySyncTimers.set(
    trackId,
    setTimeout(() => {
      historySyncTimers.delete(trackId)
      const hist = memHistory.get(trackId) ?? []
      const obj: Record<string, SensorReading> = {}
      hist.forEach((r, i) => (obj[`h${String(i).padStart(3, '0')}`] = r))
      rtdb.ref(`${PATHS.history}/${trackId}`).set(obj)
        .catch((e) => console.error('[RTDB] history persist:', String(e).slice(0, 100)))
    }, 500),
  )
}

/** Sensor thresholds — matches prototype hardware calibration.
 *  Vibration: SW-420 pulse count per 500ms window.
 *    Normal 25-30 Hz ≈ 12-15 pulses → safe.
 *    Resonance 50-80 Hz ≈ 25-40 pulses → warning.
 *    High-freq defect 100-400 Hz ≥ 50 pulses → critical.
 *  Ultrasonic: mounted 20 cm above track.
 *    ≤ 20 cm → normal.
 *    20–25 cm → warning (track starting to displace).
 *    > 25 cm → critical (track displaced). */
export const THRESH = {
  vibrationWarn: 25,       // ≥50 Hz — Resonance & Looseness range starts
  vibrationCritical: 50,   // ≥100 Hz — High-Frequency Defect range starts
  distanceWarn: 25,        // >25 cm → critical; 20-25cm → warning
}

interface LiveTrack {
  vibration?: number | null
  displacement?: number | null
  temperature?: number | null
  irBlocked?: number
  baselineVibration?: number
  baselineDistance?: number
  sensorHealth?: number
  status?: 'safe' | 'warning' | 'critical'
  readingsUpdatedAt?: string | null
}

const pendingUpdates = new Map<string, { updates: Record<string, unknown>; recordedAt: string }>()
const lastNonSafeAt = new Map<string, number>()
const applyTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function applyTrackTrigger(trackId: string, sensorType: string, value: number, recordedAt: string): void {
  const entry = pendingUpdates.get(trackId) ?? { updates: {}, recordedAt }
  entry.recordedAt = recordedAt

  // WORST-CASE LATCH: burst window er moddhe sobcheye kharap value take rakhbo —
  // nahole ekta real spike porer normal reading ese dhushor kore dey.
  switch (sensorType) {
    case 'temperature':
      entry.updates.temperature = value
      break
    case 'vibration':
      entry.updates.vibration = Math.max(entry.updates.vibration as number ?? -Infinity, value)
      break
    case 'ultrasonic':
      entry.updates.displacement = Math.max(entry.updates.displacement as number ?? -Infinity, value)
      break
    case 'ir_beam':
      entry.updates.irBlocked = (entry.updates.irBlocked as number ?? 0) | (value === 0 ? 1 : 0)
      break
    default:
      return
  }

  pendingUpdates.set(trackId, entry)

  // Debounce: reset timer per arriving reading so a burst applies once.
  const existing = applyTimers.get(trackId)
  if (existing) clearTimeout(existing)
  applyTimers.set(
    trackId,
    setTimeout(() => {
      applyTimers.delete(trackId)
      void flushTrackUpdate(trackId)
    }, 400),
  )
}

async function flushTrackUpdate(trackId: string): Promise<void> {
  const entry = pendingUpdates.get(trackId)
  if (!entry) return
  pendingUpdates.delete(trackId)

  const t = (memLive.get(trackId) ?? {}) as LiveTrack
  const u = entry.updates

  if (u.vibration !== undefined) {
    u.baselineVibration = 0.7 * (t.baselineVibration ?? 0) + 0.3 * (u.vibration as number)
  }

  const irBlocked = (u.irBlocked as number | undefined) ?? t.irBlocked ?? 0
  const vibration = (u.vibration as number | undefined) ?? t.vibration ?? 0
  // No reading yet → safe distance
  const displacement = (u.displacement as number | undefined) ?? 0

  let health = 100
  if (irBlocked === 1) health -= 45
  if (vibration >= THRESH.vibrationCritical) health -= 40
  else if (vibration >= THRESH.vibrationWarn) health -= 30
  // Distance: >25cm critical (displaced), 20-25cm warning
  if (displacement > THRESH.distanceWarn) health -= 40
  else if (displacement > 20) health -= 15
  health = Math.max(health, 0)

  let status: 'safe' | 'warning' | 'critical' =
    irBlocked === 1 ||
    vibration >= THRESH.vibrationCritical ||
    displacement > THRESH.distanceWarn
      ? 'critical'
      : vibration >= THRESH.vibrationWarn || displacement > 20
        ? 'warning'
        : 'safe'

  // HOLD-DOWN: ekbar warning/critical hole minimum 4s thakbe — ektu matro
  // normal value asle status sathe sathe safe hoye flicker korbe na.
  // MUST run BEFORE creating merged, so the hold-down values end up in memLive.
  const HOLD_MS = 4000
  const now = Date.now()
  const prevStatus = (t.status ?? 'safe') as string
  const prevHealth = t.sensorHealth ?? 100
  const lastBad = Number(lastNonSafeAt.get(trackId) ?? 0)
  if (status !== 'safe') {
    lastNonSafeAt.set(trackId, now)
  } else if ((prevStatus === 'warning' || prevStatus === 'critical') && now - lastBad < HOLD_MS) {
    status = prevStatus as 'warning' | 'critical'
    health = Math.min(prevHealth, health) // keep degraded health during hold
  }

  const merged = {
    ...t,
    ...u,
    sensorHealth: health,
    status,
    readingsUpdatedAt: entry.recordedAt,
  }

  // Memory FIRST (instant for /api/tracks), then background RTDB persist.
  memLive.set(trackId, merged)
  rtdb.ref(`${PATHS.live}/${trackId}`).update({
    vibration: merged.vibration ?? null,
    displacement: merged.displacement ?? null,
    temperature: merged.temperature ?? null,
    irBlocked: merged.irBlocked ?? 0,
    baselineVibration: u.baselineVibration ?? t.baselineVibration ?? 0,
    baselineDistance: u.baselineDistance ?? t.baselineDistance ?? 20,
    sensorHealth: merged.sensorHealth,
    status: merged.status,
    readingsUpdatedAt: merged.readingsUpdatedAt,
  }).catch((e) => console.error('[RTDB] live persist:', String(e).slice(0, 100)))
}
