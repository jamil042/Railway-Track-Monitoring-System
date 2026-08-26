import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore } from '../db/index.js'
import type { Fault } from '../types/index.js'

function toFault(id: string, d: FirebaseFirestore.DocumentData): Fault {
  return {
    id,
    stationId: d.stationId,
    stationName: d.stationName ?? undefined,
    trackId: d.trackId ?? null,
    faultType: d.faultType,
    severity: d.severity,
    detectionTime: d.detectionTime,
    status: d.status,
    imageUrl: d.imageUrl ?? null,
    aiConfidence: d.aiConfidence ?? 0,
    sensorValues: d.sensorValues ?? undefined,
    remarks: d.remarks ?? null,
    description: d.description ?? null,
  } as Fault
}

export interface FaultFilters {
  status?: string
  severity?: string
  stationId?: string
  search?: string
}

export async function listFaults(filters: FaultFilters = {}): Promise<Fault[]> {
  let q = firestore.collection(COL.faults) as FirebaseFirestore.Query
  if (filters.status) q = q.where('status', '==', filters.status)
  if (filters.severity) q = q.where('severity', '==', filters.severity)
  if (filters.stationId) q = q.where('stationId', '==', filters.stationId)

  const snap = await q.get()
  let faults = snap.docs.map((d) => toFault(d.id, d.data()))

  // detectionTime DESC + substring search are done in memory (Firestore has no LIKE)
  faults.sort((a, b) => (a.detectionTime < b.detectionTime ? 1 : -1))
  if (filters.search) {
    const s = filters.search.toLowerCase()
    faults = faults.filter(
      (f) =>
        f.faultType?.toLowerCase().includes(s) ||
        f.remarks?.toLowerCase().includes(s) ||
        f.description?.toLowerCase().includes(s),
    )
  }
  return faults
}

export async function getFault(id: string): Promise<Fault> {
  const snap = await firestore.collection(COL.faults).doc(id).get()
  if (!snap.exists) throw new ApiError(404, `Fault '${id}' not found`)
  return toFault(snap.id, snap.data()!)
}

export async function createFault(data: Partial<Fault>): Promise<Fault> {
  const id = data.id?.trim() || `FLT-${Date.now()}`
  const station = data.stationId
    ? await firestore.collection(COL.stations).doc(data.stationId).get()
    : undefined

  await firestore.collection(COL.faults).doc(id).set({
    stationId: data.stationId ?? '',
    stationName: station?.exists ? station.data()?.name : null,
    trackId: data.trackId ?? null,
    faultType: data.faultType ?? '',
    severity: data.severity ?? 'low',
    detectionTime: data.detectionTime ?? new Date().toISOString(),
    status: data.status ?? 'active',
    imageUrl: data.imageUrl ?? null,
    aiConfidence: data.aiConfidence ?? 0,
    sensorValues: data.sensorValues ?? null,
    remarks: data.remarks ?? null,
    description: data.description ?? null,
  })
  return getFault(id)
}

const UPDATABLE = [
  'stationId',
  'trackId',
  'faultType',
  'severity',
  'detectionTime',
  'status',
  'imageUrl',
  'aiConfidence',
  'sensorValues',
  'remarks',
  'description',
] as const

export async function updateFault(id: string, data: Partial<Fault>): Promise<Fault> {
  await getFault(id)
  const updates: Record<string, unknown> = {}
  for (const key of UPDATABLE) {
    if (data[key] !== undefined) updates[key] = data[key]
  }
  if (updates.stationId !== undefined) {
    const station = await firestore.collection(COL.stations).doc(String(updates.stationId)).get()
    updates.stationName = station.exists ? station.data()?.name : null
  }
  if (Object.keys(updates).length > 0) {
    await firestore.collection(COL.faults).doc(id).update(updates)
  }
  return getFault(id)
}

export async function deleteFault(id: string): Promise<void> {
  const batch = firestore.batch()
  batch.delete(firestore.collection(COL.faults).doc(id))

  // ON DELETE CASCADE: maintenance tasks + alert logs of this fault
  for (const col of [COL.maintenanceTasks, COL.alertLogs]) {
    const snap = await firestore.collection(col).where('faultId', '==', id).get()
    snap.docs.forEach((d) => batch.delete(d.ref))
  }
  await batch.commit()
}
