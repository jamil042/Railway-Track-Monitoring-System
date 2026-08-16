import { db } from '../db/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { SensorReading } from '../types/index.js'

const SELECT = `
  SELECT id, device_id AS deviceId, track_id AS trackId, sensor_type AS sensorType,
         value, unit, recorded_at AS recordedAt
  FROM sensor_readings`

export interface ReadingFilters {
  deviceId?: number
  trackId?: string
  sensorType?: string
  limit?: number
}

export function listReadings(filters: ReadingFilters = {}): SensorReading[] {
  const where: string[] = []
  const params: Record<string, unknown> = {}

  if (filters.deviceId !== undefined) {
    where.push('device_id = @deviceId')
    params.deviceId = filters.deviceId
  }
  if (filters.trackId) {
    where.push('track_id = @trackId')
    params.trackId = filters.trackId
  }
  if (filters.sensorType) {
    where.push('sensor_type = @sensorType')
    params.sensorType = filters.sensorType
  }

  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY recordedAt DESC LIMIT @limit`
  return db.prepare(sql).all({ ...params, limit: Math.min(filters.limit ?? 100, 1000) }) as SensorReading[]
}

/**
 * Ingest a telemetry point. This is the endpoint the ESP32 / Raspberry Pi
 * nodes push to. Inserting a reading automatically refreshes the cached
 * latest values on the referenced track via the trg_track_latest_reading
 * trigger defined in the schema.
 */
export function createReading(data: Partial<SensorReading>): SensorReading {
  const deviceId = data.deviceId
  if (!deviceId) throw new ApiError(400, 'deviceId is required')
  if (!data.sensorType) throw new ApiError(400, 'sensorType is required')

  const result = db
    .prepare(
      `INSERT INTO sensor_readings (device_id, track_id, sensor_type, value, unit, recorded_at)
       VALUES (@deviceId, @trackId, @sensorType, @value, @unit, @recordedAt)`,
    )
    .run({
      deviceId,
      trackId: data.trackId ?? null,
      sensorType: data.sensorType,
      value: data.value ?? 0,
      unit: data.unit ?? null,
      recordedAt: data.recordedAt ?? new Date().toISOString(),
    })

  // Realtime pruning: the backend stores only the LATEST reading per
  // (device_id, track_id, sensor_type). Older rows for the same slot are
  // deleted so the DB doesn't grow without bound — only live data remains.
  const newId = Number(result.lastInsertRowid)
  db.prepare(
    `DELETE FROM sensor_readings
      WHERE device_id = @deviceId
        AND track_id  IS @trackId
        AND sensor_type = @sensorType
        AND id <> @newId`,
  ).run({ deviceId, trackId: data.trackId ?? null, sensorType: data.sensorType, newId })

  return getReading(newId)
}

export function getReading(id: number): SensorReading {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as SensorReading | undefined
  if (!row) throw new ApiError(404, `Reading #${id} not found`)
  return row
}