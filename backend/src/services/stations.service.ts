import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore, nextId } from '../db/index.js'
import type { Station } from '../types/index.js'

function toStation(id: string, d: FirebaseFirestore.DocumentData): Station {
  return {
    id,
    name: d.name,
    location: d.location,
    totalTracks: d.totalTracks ?? 0,
    status: d.status,
    activeFaults: d.activeFaults ?? 0,
  } as Station
}

/**
 * Replaces v_station_summary / v_dashboard_stats aggregates. Tracks carry a
 * denormalized stationName; faults carry stationId — both collections are
 * small enough to aggregate client-side.
 */
async function withActiveFaults(id: string, data: FirebaseFirestore.DocumentData): Promise<Station> {
  // Counted client-side to avoid a composite index (stationId + status != fixed).
  const snap = await firestore.collection(COL.faults).where('stationId', '==', id).get()
  const activeFaults = snap.docs.filter((d) => d.data().status !== 'fixed').length
  return toStation(id, { ...data, activeFaults })
}

export async function listStations(stationId?: string | null): Promise<Station[]> {
  if (stationId) {
    const snap = await firestore.collection(COL.stations).doc(stationId).get()
    if (!snap.exists) throw new ApiError(404, `Station '${stationId}' not found`)
    return [await withActiveFaults(snap.id, snap.data()!)]
  }
  const snap = await firestore.collection(COL.stations).orderBy('name').get()
  return Promise.all(snap.docs.map((d) => withActiveFaults(d.id, d.data())))
}

export async function getStation(id: string): Promise<Station> {
  const snap = await firestore.collection(COL.stations).doc(id).get()
  if (!snap.exists) throw new ApiError(404, `Station '${id}' not found`)
  return withActiveFaults(snap.id, snap.data()!)
}

export async function createStation(data: Partial<Station>): Promise<Station> {
  const id = data.id?.trim() || `st${Date.now()}`
  await firestore.collection(COL.stations).doc(id).set({
    name: data.name ?? '',
    location: data.location ?? '',
    totalTracks: data.totalTracks ?? 0,
    status: data.status ?? 'safe',
  })
  return getStation(id)
}

export async function updateStation(id: string, data: Partial<Station>): Promise<Station> {
  const ref = firestore.collection(COL.stations).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new ApiError(404, `Station '${id}' not found`)
  const cur = snap.data()!

  const updates: Record<string, unknown> = {
    name: data.name ?? cur.name,
    location: data.location ?? cur.location,
    totalTracks: data.totalTracks ?? cur.totalTracks,
    status: data.status ?? cur.status,
  }
  await ref.update(updates)

  // Keep denormalized stationName on tracks in sync.
  if (updates.name !== cur.name) {
    const tracks = await firestore.collection(COL.tracks).where('stationId', '==', id).get()
    const batch = firestore.batch()
    tracks.docs.forEach((d) => batch.update(d.ref, { stationName: updates.name }))
    await batch.commit()
  }
  return getStation(id)
}

export async function deleteStation(id: string): Promise<void> {
  // RESTRICT semantics (replaces ON DELETE RESTRICT on faults.station_id)
  const faults = await firestore.collection(COL.faults).where('stationId', '==', id).limit(1).get()
  if (!faults.empty) {
    throw new ApiError(409, 'Cannot delete a station that still has faults')
  }

  const batch = firestore.batch()
  batch.delete(firestore.collection(COL.stations).doc(id))

  for (const [col, field] of [
    [COL.tracks, 'stationId'],
    [COL.devices, 'stationId'],
    [COL.users, 'stationId'],
  ] as const) {
    const snap = await firestore.collection(col).where(field, '==', id).get()
    snap.docs.forEach((d) => {
      if (col === COL.users) batch.update(d.ref, { [field]: null })
      else batch.delete(d.ref)
    })
  }
  await batch.commit()
}
