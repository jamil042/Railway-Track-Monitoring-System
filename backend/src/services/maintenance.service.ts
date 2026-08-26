import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore } from '../db/index.js'
import type { MaintenanceTask } from '../types/index.js'

function toTask(id: string, d: FirebaseFirestore.DocumentData): MaintenanceTask {
  return {
    id,
    faultId: d.faultId,
    faultType: d.faultType ?? undefined,
    stationName: d.stationName ?? undefined,
    trackId: d.trackId ?? null,
    assignedTeam: d.assignedTeam,
    engineer: d.engineer,
    progress: d.progress ?? 0,
    status: d.status,
    startTime: d.startTime ?? undefined,
    completionTime: d.completionTime ?? undefined,
  } as MaintenanceTask
}

export async function listTasks(stationId?: string | null): Promise<MaintenanceTask[]> {
  let q = firestore.collection(COL.maintenanceTasks) as FirebaseFirestore.Query
  if (stationId) q = q.where('stationId', '==', stationId)
  const snap = await q.get()
  return snap.docs
    .map((d) => toTask(d.id, d.data()))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function getTask(id: string): Promise<MaintenanceTask> {
  const snap = await firestore.collection(COL.maintenanceTasks).doc(id).get()
  if (!snap.exists) throw new ApiError(404, `Maintenance task '${id}' not found`)
  return toTask(snap.id, snap.data()!)
}

export async function createTask(data: Partial<MaintenanceTask>): Promise<MaintenanceTask> {
  const id = data.id?.trim() || `MNT-${Date.now()}`

  // Replaces v_maintenance_details join: denormalize faultType/stationId/stationName.
  let stationId: string | null = null
  let stationName: string | null = null
  let faultType: string | null = null
  if (data.faultId) {
    const fault = await firestore.collection(COL.faults).doc(data.faultId).get()
    if (fault.exists) {
      faultType = fault.data()?.faultType ?? null
      stationId = fault.data()?.stationId ?? null
      stationName = fault.data()?.stationName ?? null
    }
  }

  await firestore.collection(COL.maintenanceTasks).doc(id).set({
    faultId: data.faultId ?? '',
    trackId: data.trackId ?? null,
    assignedTeam: data.assignedTeam ?? '',
    engineer: data.engineer ?? '',
    progress: data.progress ?? 0,
    status: data.status ?? 'pending',
    startTime: data.startTime ?? null,
    completionTime: data.completionTime ?? null,
    stationId,
    stationName,
    faultType,
  })
  return getTask(id)
}

const UPDATABLE = ['faultId', 'trackId', 'assignedTeam', 'engineer', 'progress', 'status', 'startTime', 'completionTime'] as const

export async function updateTask(id: string, data: Partial<MaintenanceTask>): Promise<MaintenanceTask> {
  await getTask(id)
  const updates: Record<string, unknown> = {}
  for (const key of UPDATABLE) {
    if (data[key] !== undefined) updates[key] = data[key]
  }
  if (Object.keys(updates).length > 0) {
    await firestore.collection(COL.maintenanceTasks).doc(id).update(updates)
  }
  return getTask(id)
}

export async function deleteTask(id: string): Promise<void> {
  const ref = firestore.collection(COL.maintenanceTasks).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new ApiError(404, `Maintenance task '${id}' not found`)
  await ref.delete()
}
