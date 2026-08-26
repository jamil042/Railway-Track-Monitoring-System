import { FieldValue } from 'firebase-admin/firestore'
import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore } from '../db/index.js'
import { getAllLiveOverlay } from './sensorReadings.service.js'
import type { Track } from '../types/index.js'

interface TrackDoc {
  stationId: string
  stationName?: string
  status: Track['status']
  sensorHealth: number
  imageUrl: string | null
  temperature?: number | null
  vibration?: number | null
  displacement?: number | null
  baselineDistance: number
  baselineVibration: number
  irBlocked: number
  readingsUpdatedAt?: string | null
}

function toTrack(id: string, d: FirebaseFirestore.DocumentData): Track {
  return {
    id,
    stationId: d.stationId,
    stationName: d.stationName,
    status: d.status,
    sensorHealth: d.sensorHealth,
    lastUpdated: d.readingsUpdatedAt ?? undefined,
    imageUrl: d.imageUrl ?? undefined,
    temperature: d.temperature ?? undefined,
    vibration: d.vibration ?? undefined,
    displacement: d.displacement ?? undefined,
    baselineDistance: d.baselineDistance,
    baselineVibration: d.baselineVibration,
    irBlocked: d.irBlocked,
  } as Track
}

export async function listTracks(stationId?: string | null): Promise<Track[]> {
  let q = firestore.collection(COL.tracks).orderBy('__name__') as FirebaseFirestore.Query
  if (stationId) q = q.where('stationId', '==', stationId)
  const snap = await q.get()

  // Live telemetry overlay served from the in-memory hot cache (zero latency).
  const live = getAllLiveOverlay()

  return snap.docs.map((d) => toTrack(d.id, { ...d.data(), ...(live[d.id] ?? {}) }))
}

export async function getTrackDoc(id: string): Promise<TrackDoc> {
  const snap = await firestore.collection(COL.tracks).doc(id).get()
  if (!snap.exists) throw new ApiError(404, `Track '${id}' not found`)
  return snap.data() as TrackDoc
}

export async function getTrack(id: string): Promise<Track> {
  const doc = await getTrackDoc(id)
  const live = getAllLiveOverlay()[id] ?? {}
  return toTrack(id, { ...doc, ...live } as unknown as FirebaseFirestore.DocumentData)
}

export async function createTrack(data: Partial<Track>): Promise<Track> {
  const id = data.id?.trim() || `TR-${Date.now()}`
  const station = data.stationId
    ? await firestore.collection(COL.stations).doc(data.stationId).get()
    : undefined

  await firestore.collection(COL.tracks).doc(id).set({
    stationId: data.stationId ?? '',
    stationName: station?.exists ? station.data()?.name : null,
    status: data.status ?? 'safe',
    sensorHealth: data.sensorHealth ?? 100,
    imageUrl: data.imageUrl ?? null,
    temperature: null,
    vibration: null,
    displacement: null,
    baselineDistance: 20,
    baselineVibration: 0,
    irBlocked: 0,
    readingsUpdatedAt: null,
  })
  return getTrack(id)
}

const TRACK_UPDATABLE = ['stationId', 'status', 'sensorHealth', 'imageUrl'] as const

export async function updateTrack(id: string, data: Partial<Track>): Promise<Track> {
  await getTrackDoc(id)
  const updates: Record<string, unknown> = {}
  for (const key of TRACK_UPDATABLE) {
    if (data[key] !== undefined) updates[key] = data[key]
  }
  if (updates.stationId !== undefined) {
    const station = await firestore.collection(COL.stations).doc(String(updates.stationId)).get()
    updates.stationName = station.exists ? station.data()?.name : null
  }
  if (Object.keys(updates).length > 0) {
    await firestore.collection(COL.tracks).doc(id).update(updates)
  }
  return getTrack(id)
}

export async function deleteTrack(id: string): Promise<void> {
  const batch = firestore.batch()
  batch.delete(firestore.collection(COL.tracks).doc(id))

  // Cascade: delete child sensor readings (replaces ON DELETE CASCADE)
  const readings = await firestore.collection(COL.sensorReadings).where('trackId', '==', id).get()
  readings.docs.forEach((d) => batch.delete(d.ref))

  // Set-null children (replaces ON DELETE SET NULL)
  for (const col of [COL.faults, COL.maintenanceTasks, COL.devices]) {
    const snap = await firestore.collection(col).where('trackId', '==', id).get()
    snap.docs.forEach((d) => batch.update(d.ref, { trackId: null }))
  }

  await batch.commit()
}
