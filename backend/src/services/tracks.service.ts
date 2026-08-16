import { db } from '../db/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { Track } from '../types/index.js'

const SELECT = `
  SELECT id, station_id AS stationId, station_name AS stationName, status,
         sensor_health AS sensorHealth, readings_updated_at AS lastUpdated, image_url AS imageUrl,
         temperature, vibration, displacement
  FROM v_track_with_station`

export function listTracks(): Track[] {
  return db.prepare(`${SELECT} ORDER BY id`).all() as Track[]
}

export function getTrack(id: string): Track {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Track | undefined
  if (!row) throw new ApiError(404, `Track '${id}' not found`)
  return row
}

export function createTrack(data: Partial<Track>): Track {
  const id = data.id?.trim() || `TR-${Date.now()}`
  db.prepare(
    `INSERT INTO tracks (id, station_id, status, sensor_health, image_url)
     VALUES (@id, @stationId, @status, @sensorHealth, @imageUrl)`,
  ).run({
    id,
    stationId: data.stationId ?? '',
    status: data.status ?? 'safe',
    sensorHealth: data.sensorHealth ?? 100,
    imageUrl: data.imageUrl ?? null,
  })
  return getTrack(id)
}

export function updateTrack(id: string, data: Partial<Track>): Track {
  const current = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Track
  if (!current) throw new ApiError(404, `Track '${id}' not found`)

  db.prepare(
    `UPDATE tracks
     SET station_id = @stationId, status = @status, sensor_health = @sensorHealth, image_url = @imageUrl
     WHERE id = @id`,
  ).run({
    id,
    stationId: data.stationId ?? current.stationId,
    status: data.status ?? current.status,
    sensorHealth: data.sensorHealth ?? current.sensorHealth,
    imageUrl: data.imageUrl ?? current.imageUrl,
  })
  return getTrack(id)
}

export function deleteTrack(id: string): void {
  const result = db.prepare('DELETE FROM tracks WHERE id = ?').run(id)
  if (result.changes === 0) throw new ApiError(404, `Track '${id}' not found`)
}