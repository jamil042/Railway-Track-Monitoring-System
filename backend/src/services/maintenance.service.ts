import { db } from '../db/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { MaintenanceTask } from '../types/index.js'

const SELECT = `
  SELECT id, fault_id AS faultId, fault_type AS faultType, station_name AS stationName,
         track_id AS trackId, assigned_team AS assignedTeam, engineer,
         progress, status, start_time AS startTime, completion_time AS completionTime
  FROM v_maintenance_details`

export function listTasks(): MaintenanceTask[] {
  return db.prepare(`${SELECT} ORDER BY id`).all() as MaintenanceTask[]
}

export function getTask(id: string): MaintenanceTask {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as MaintenanceTask | undefined
  if (!row) throw new ApiError(404, `Maintenance task '${id}' not found`)
  return row
}

export function createTask(data: Partial<MaintenanceTask>): MaintenanceTask {
  const id = data.id?.trim() || `MNT-${Date.now()}`
  db.prepare(
    `INSERT INTO maintenance_tasks (id, fault_id, track_id, assigned_team, engineer, progress, status, start_time, completion_time)
     VALUES (@id, @faultId, @trackId, @assignedTeam, @engineer, @progress, @status, @startTime, @completionTime)`,
  ).run({
    id,
    faultId: data.faultId ?? '',
    trackId: data.trackId ?? null,
    assignedTeam: data.assignedTeam ?? '',
    engineer: data.engineer ?? '',
    progress: data.progress ?? 0,
    status: data.status ?? 'pending',
    startTime: data.startTime ?? null,
    completionTime: data.completionTime ?? null,
  })
  return getTask(id)
}

const UPDATABLE = ['faultId', 'trackId', 'assignedTeam', 'engineer', 'progress', 'status', 'startTime', 'completionTime'] as const

export function updateTask(id: string, data: Partial<MaintenanceTask>): MaintenanceTask {
  getTask(id)

  const sets = UPDATABLE.filter((key) => data[key] !== undefined)
  if (sets.length === 0) return getTask(id)

  const columns = sets.map((key) => `${columnFor(key)} = @${key}`).join(', ')
  db.prepare(`UPDATE maintenance_tasks SET ${columns} WHERE id = @id`).run({ id, ...pick(data, sets) })
  return getTask(id)
}

export function deleteTask(id: string): void {
  const result = db.prepare('DELETE FROM maintenance_tasks WHERE id = ?').run(id)
  if (result.changes === 0) throw new ApiError(404, `Maintenance task '${id}' not found`)
}

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const key of keys) out[key] = obj[key]
  return out
}

function columnFor(key: string): string {
  const map: Record<string, string> = {
    faultId: 'fault_id',
    trackId: 'track_id',
    assignedTeam: 'assigned_team',
    startTime: 'start_time',
    completionTime: 'completion_time',
  }
  return map[key] ?? key
}