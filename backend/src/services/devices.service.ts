import { db } from '../db/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { Device } from '../types/index.js'

const SELECT = `
  SELECT id, station_id AS stationId, track_id AS trackId, device_type AS deviceType,
         name, status, firmware_version AS firmwareVersion, location,
         installed_at AS installedAt, last_heartbeat AS lastHeartbeat
  FROM devices`

export function listDevices(stationId?: string | null): Device[] {
  if (stationId) {
    return db.prepare(`${SELECT} WHERE station_id = ? ORDER BY id`).all(stationId) as Device[]
  }
  return db.prepare(`${SELECT} ORDER BY id`).all() as Device[]
}

export function getDevice(id: number): Device {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Device | undefined
  if (!row) throw new ApiError(404, `Device #${id} not found`)
  return row
}

export function createDevice(data: Partial<Device>): Device {
  const result = db
    .prepare(
      `INSERT INTO devices (station_id, track_id, device_type, name, status, firmware_version, location, installed_at, last_heartbeat)
       VALUES (@stationId, @trackId, @deviceType, @name, @status, @firmwareVersion, @location, @installedAt, @lastHeartbeat)`,
    )
    .run({
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
  return getDevice(Number(result.lastInsertRowid))
}

const UPDATABLE = ['stationId', 'trackId', 'deviceType', 'name', 'status', 'firmwareVersion', 'location', 'installedAt', 'lastHeartbeat'] as const

export function updateDevice(id: number, data: Partial<Device>): Device {
  getDevice(id)

  const sets = UPDATABLE.filter((key) => data[key] !== undefined)
  if (sets.length === 0) return getDevice(id)

  const columns = sets.map((key) => `${columnFor(key)} = @${key}`).join(', ')
  db.prepare(`UPDATE devices SET ${columns} WHERE id = @id`).run({ id, ...pick(data, sets) })
  return getDevice(id)
}

export function deleteDevice(id: number): void {
  const result = db.prepare('DELETE FROM devices WHERE id = ?').run(id)
  if (result.changes === 0) throw new ApiError(404, `Device #${id} not found`)
}

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const key of keys) out[key] = obj[key]
  return out
}

function columnFor(key: string): string {
  const map: Record<string, string> = {
    stationId: 'station_id',
    trackId: 'track_id',
    deviceType: 'device_type',
    firmwareVersion: 'firmware_version',
    installedAt: 'installed_at',
    lastHeartbeat: 'last_heartbeat',
  }
  return map[key] ?? key
}