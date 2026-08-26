import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore, nextId } from '../db/index.js'
import type { Device } from '../types/index.js'

function toDevice(id: string, d: FirebaseFirestore.DocumentData): Device {
  return {
    id: Number(id),
    stationId: d.stationId,
    trackId: d.trackId ?? null,
    deviceType: d.deviceType,
    name: d.name,
    status: d.status,
    firmwareVersion: d.firmwareVersion ?? undefined,
    location: d.location ?? undefined,
    installedAt: d.installedAt ?? undefined,
    lastHeartbeat: d.lastHeartbeat ?? undefined,
  } as Device
}

export async function listDevices(stationId?: string | null): Promise<Device[]> {
  let q = firestore.collection(COL.devices) as FirebaseFirestore.Query
  if (stationId) q = q.where('stationId', '==', stationId)
  const snap = await q.get()
  return snap.docs
    .map((d) => toDevice(d.id, d.data()))
    .sort((a, b) => a.id - b.id)
}

export async function getDevice(id: number): Promise<Device> {
  const snap = await firestore.collection(COL.devices).doc(String(id)).get()
  if (!snap.exists) throw new ApiError(404, `Device #${id} not found`)
  return toDevice(snap.id, snap.data()!)
}

export async function createDevice(data: Partial<Device>): Promise<Device> {
  const id = await nextId(COL.devices)
  await firestore.collection(COL.devices).doc(String(id)).set({
    stationId: data.stationId ?? '',
    trackId: data.trackId ?? null,
    deviceType: data.deviceType ?? 'esp32_sensor_node',
    name: data.name ?? '',
    status: data.status ?? 'online',
    firmwareVersion: data.firmwareVersion ?? null,
    location: data.location ?? null,
    installedAt: data.installedAt ?? null,
    lastHeartbeat: data.lastHeartbeat ?? null,
  })
  return getDevice(id)
}

const UPDATABLE = ['stationId', 'trackId', 'deviceType', 'name', 'status', 'firmwareVersion', 'location', 'installedAt', 'lastHeartbeat'] as const

export async function updateDevice(id: number, data: Partial<Device>): Promise<Device> {
  await getDevice(id)
  const updates: Record<string, unknown> = {}
  for (const key of UPDATABLE) {
    if (data[key] !== undefined) updates[key] = data[key]
  }
  if (Object.keys(updates).length > 0) {
    await firestore.collection(COL.devices).doc(String(id)).update(updates)
  }
  return getDevice(id)
}

export async function deleteDevice(id: number): Promise<void> {
  const ref = firestore.collection(COL.devices).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) throw new ApiError(404, `Device #${id} not found`)

  const batch = firestore.batch()
  batch.delete(ref)

  // ON DELETE SET NULL for alert logs referencing the device
  const alerts = await firestore.collection(COL.alertLogs).where('deviceId', '==', id).get()
  alerts.docs.forEach((d) => batch.update(d.ref, { deviceId: null }))
  const readings = await firestore.collection(COL.sensorReadings).where('deviceId', '==', id).get()
  readings.docs.forEach((d) => batch.delete(d.ref))

  await batch.commit()
}
