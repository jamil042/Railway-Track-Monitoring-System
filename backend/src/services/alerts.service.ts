import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore, nextId } from '../db/index.js'
import type { AlertLog } from '../types/index.js'

function toAlert(id: string, d: FirebaseFirestore.DocumentData): AlertLog {
  return {
    id: Number(id),
    faultId: d.faultId,
    deviceId: d.deviceId ?? null,
    destination: d.destination,
    channel: d.channel ?? 'lora',
    message: d.message ?? '',
    severity: d.severity ?? 'medium',
    sentAt: d.sentAt,
    acknowledgedAt: d.acknowledgedAt ?? null,
    acknowledgedBy: d.acknowledgedBy ?? null,
    stationId: d.stationId ?? null,
  } as AlertLog
}

export async function listAlerts(stationId?: string | null): Promise<AlertLog[]> {
  let snap = await firestore.collection(COL.alertLogs).get()
  let alerts = snap.docs.map((d) => toAlert(d.id, d.data()))
  if (stationId) alerts = alerts.filter((a) => a.stationId === stationId)
  return alerts.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))
}

export async function getAlert(id: number): Promise<AlertLog> {
  const snap = await firestore.collection(COL.alertLogs).doc(String(id)).get()
  if (!snap.exists) throw new ApiError(404, `Alert #${id} not found`)
  return toAlert(snap.id, snap.data()!)
}

export async function createAlert(data: Partial<AlertLog>): Promise<AlertLog> {
  if (!data.faultId || !data.destination) {
    throw new ApiError(400, 'faultId and destination are required')
  }
  const id = await nextId(COL.alertLogs)
  await firestore.collection(COL.alertLogs).doc(String(id)).set({
    faultId: data.faultId,
    deviceId: data.deviceId ?? null,
    destination: data.destination,
    channel: data.channel ?? 'lora',
    message: data.message ?? '',
    severity: data.severity ?? 'medium',
    stationId: data.stationId ?? null,
    sentAt: data.sentAt ?? new Date().toISOString(),
    acknowledgedAt: null,
    acknowledgedBy: null,
  })
  return getAlert(id)
}

export async function acknowledgeAlert(id: number, acknowledgedBy?: number): Promise<AlertLog> {
  await getAlert(id)
  await firestore.collection(COL.alertLogs).doc(String(id)).update({
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: acknowledgedBy ?? null,
  })
  return getAlert(id)
}
