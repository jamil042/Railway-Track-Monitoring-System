import { FieldValue } from 'firebase-admin/firestore'
import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore, nextId } from '../db/index.js'
import type { SensorReading, Track } from '../types/index.js'

export interface ReadingFilters {
  deviceId?: number
  trackId?: string
  sensorType?: string
  stationId?: string
  limit?: number
}

export async function listReadings(filters: ReadingFilters = {}): Promise<SensorReading[]> {
  let q = firestore.collection(COL.sensorReadings) as FirebaseFirestore.Query
  if (filters.deviceId !== undefined) q = q.where('deviceId', '==', filters.deviceId)
  if (filters.trackId) q = q.where('trackId', '==', filters.trackId)
  if (filters.sensorType) q = q.where('sensorType', '==', filters.sensorType)

  const snap = await q.get()
  let readings = snap.docs.map((d) => ({ ...d.data(), id: Number(d.id) }) as unknown as SensorReading)

  if (filters.stationId) {
    // Station scope: only readings of tracks belonging to this station.
    const tracks = await firestore.collection(COL.tracks).where('stationId', '==', filters.stationId).get()
    const ids = new Set(tracks.docs.map((d) => d.id))
    readings = readings.filter((r) => r.trackId && ids.has(r.trackId))
  }

  readings.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))
  return readings.slice(0, Math.min(filters.limit ?? 100, 1000))
}

export async function getReading(id: number): Promise<SensorReading> {
  const snap = await firestore.collection(COL.sensorReadings).doc(String(id)).get()
  if (!snap.exists) throw new ApiError(404, `Reading #${id} not found`)
  return { ...snap.data!(), id } as unknown as SensorReading
}

/**
 * Ingest a telemetry point (the endpoint ESP32 / Raspberry Pi nodes push to).
 * Ports the former trg_track_latest_reading trigger:
 *   - refresh cached latest values on the track,
 *   - update the slow-moving EMA baselines,
 *   - recompute sensor_health + status from deviation vs baseline.
 */
export async function createReading(data: Partial<SensorReading>): Promise<SensorReading> {
  const deviceId = data.deviceId
  if (!deviceId) throw new ApiError(400, 'deviceId is required')
  if (!data.sensorType) throw new ApiError(400, 'sensorType is required')

  const id = await nextId(COL.sensorReadings)
  const recordedAt = data.recordedAt ?? new Date().toISOString()

  await firestore.collection(COL.sensorReadings).doc(String(id)).set({
    deviceId,
    trackId: data.trackId ?? null,
    sensorType: data.sensorType,
    value: data.value ?? 0,
    unit: data.unit ?? null,
    recordedAt,
  })

  // Realtime pruning: keep only the LATEST reading per (device, track, type).
  if (data.trackId) {
    const dupes = await firestore
      .collection(COL.sensorReadings)
      .where('deviceId', '==', deviceId)
      .where('trackId', '==', data.trackId)
      .where('sensorType', '==', data.sensorType)
      .get()
    const stale = dupes.docs.filter((d) => d.id !== String(id))
    if (stale.length > 0) {
      const batch = firestore.batch()
      stale.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }

    await applyTrackTrigger(data.trackId, data.sensorType as string, Number(data.value ?? 0), recordedAt)
  }

  return getReading(id)
}

/** Port of trg_track_latest_reading thresholds. */
const THRESH = {
  vibrationWarn: 30,
  vibrationCritical: 60,
  distanceWarn: 50,
  distanceCritical: 100,
}

async function applyTrackTrigger(trackId: string, sensorType: string, value: number, recordedAt: string): Promise<void> {
  const ref = firestore.collection(COL.tracks).doc(trackId)
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return
    const t = snap.data() as Track

    const updates: Record<string, unknown> = { readingsUpdatedAt: recordedAt }
    switch (sensorType) {
      case 'temperature':
        updates.temperature = value
        break
      case 'vibration':
        updates.vibration = value
        updates.baselineVibration = 0.7 * (t.baselineVibration ?? 0) + 0.3 * value
        break
      case 'ultrasonic':
        updates.displacement = value
        updates.baselineDistance = 0.7 * (t.baselineDistance ?? 20) + 0.3 * value
        break
      case 'ir_beam':
        updates.irBlocked = value === 0 ? 1 : 0
        break
      default:
        break
    }

    const irBlocked = (updates.irBlocked as number | undefined) ?? t.irBlocked
    const vibration = (updates.vibration as number | undefined) ?? t.vibration ?? 0
    const displacement = (updates.displacement as number | undefined) ?? t.displacement ?? 20
    const baselineVibration = ((updates.baselineVibration as number | undefined) ?? t.baselineVibration) ?? 0
    const baselineDistance = ((updates.baselineDistance as number | undefined) ?? t.baselineDistance) ?? 20

    let health = 100
    if (irBlocked === 1) health -= 45
    if (Math.abs(vibration - baselineVibration) >= THRESH.vibrationWarn) health -= 30
    if (Math.abs(vibration - baselineVibration) >= THRESH.vibrationCritical) health -= 40
    if (Math.abs(displacement - baselineDistance) >= THRESH.distanceWarn) health -= 15
    if (Math.abs(displacement - baselineDistance) >= THRESH.distanceCritical) health -= 25

    const status =
      irBlocked === 1 ||
      Math.abs(vibration - baselineVibration) >= THRESH.vibrationCritical ||
      Math.abs(displacement - baselineDistance) >= THRESH.distanceCritical
        ? 'critical'
        : Math.abs(vibration - baselineVibration) >= THRESH.vibrationWarn ||
            Math.abs(displacement - baselineDistance) >= THRESH.distanceWarn
          ? 'warning'
          : 'safe'

    updates.sensorHealth = Math.max(health, 0)
    updates.status = status

    tx.update(ref, updates)
  })
}
