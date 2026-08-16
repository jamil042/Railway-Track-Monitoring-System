import { db } from '../db/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { Station } from '../types/index.js'

const SELECT = `
  SELECT id, name, location, total_tracks AS totalTracks, status, active_faults AS activeFaults
  FROM v_station_summary`

export function listStations(): Station[] {
  return db.prepare(`${SELECT} ORDER BY name`).all() as Station[]
}

export function getStation(id: string): Station {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Station | undefined
  if (!row) throw new ApiError(404, `Station '${id}' not found`)
  return row
}

export function createStation(data: Partial<Station>): Station {
  const id = data.id?.trim() || `st${Date.now()}`
  db.prepare(
    `INSERT INTO stations (id, name, location, total_tracks, status)
     VALUES (@id, @name, @location, @totalTracks, @status)`,
  ).run({
    id,
    name: data.name ?? '',
    location: data.location ?? '',
    totalTracks: data.totalTracks ?? 0,
    status: data.status ?? 'safe',
  })
  return getStation(id)
}

export function updateStation(id: string, data: Partial<Station>): Station {
  const current = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as Station
  if (!current) throw new ApiError(404, `Station '${id}' not found`)

  db.prepare(
    `UPDATE stations
     SET name = @name, location = @location, total_tracks = @totalTracks, status = @status
     WHERE id = @id`,
  ).run({
    id,
    name: data.name ?? current.name,
    location: data.location ?? current.location,
    totalTracks: data.totalTracks ?? current.totalTracks,
    status: data.status ?? current.status,
  })
  return getStation(id)
}

export function deleteStation(id: string): void {
  const result = db.prepare('DELETE FROM stations WHERE id = ?').run(id)
  if (result.changes === 0) throw new ApiError(404, `Station '${id}' not found`)
}