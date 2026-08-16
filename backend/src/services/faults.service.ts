import { db } from '../db/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { Fault } from '../types/index.js'

const SELECT = `
  SELECT id, station_id AS stationId, station_name AS stationName, track_id AS trackId,
         fault_type AS faultType, severity, detection_time AS detectionTime, status,
         image_url AS imageUrl, ai_confidence AS aiConfidence, sensor_values AS sensorValues,
         remarks, description
  FROM v_fault_details`

export interface FaultFilters {
  status?: string
  severity?: string
  stationId?: string
  search?: string
}

type FaultRow = Omit<Fault, 'sensorValues'> & { sensorValues?: string }

function mapFault(row: FaultRow): Fault {
  return { ...row, sensorValues: row.sensorValues ? (JSON.parse(row.sensorValues) as Fault['sensorValues']) : undefined }
}

export function listFaults(filters: FaultFilters = {}): Fault[] {
  const where: string[] = []
  const params: Record<string, unknown> = {}

  if (filters.status) {
    where.push('status = @status')
    params.status = filters.status
  }
  if (filters.severity) {
    where.push('severity = @severity')
    params.severity = filters.severity
  }
  if (filters.stationId) {
    where.push('station_id = @stationId')
    params.stationId = filters.stationId
  }
  if (filters.search) {
    where.push('(faultType LIKE @search OR remarks LIKE @search OR description LIKE @search)')
    params.search = `%${filters.search}%`
  }

  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY detectionTime DESC`
  return (db.prepare(sql).all(params) as FaultRow[]).map(mapFault)
}

export function getFault(id: string): Fault {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as FaultRow | undefined
  if (!row) throw new ApiError(404, `Fault '${id}' not found`)
  return mapFault(row)
}

export function createFault(data: Partial<Fault>): Fault {
  const id = data.id?.trim() || `FLT-${Date.now()}`
  db.prepare(
    `INSERT INTO faults (id, station_id, track_id, fault_type, severity, detection_time, status,
                         image_url, ai_confidence, sensor_values, remarks, description)
     VALUES (@id, @stationId, @trackId, @faultType, @severity, @detectionTime, @status,
             @imageUrl, @aiConfidence, @sensorValues, @remarks, @description)`,
  ).run({
    id,
    stationId: data.stationId ?? '',
    trackId: data.trackId ?? null,
    faultType: data.faultType ?? '',
    severity: data.severity ?? 'low',
    detectionTime: data.detectionTime ?? new Date().toISOString(),
    status: data.status ?? 'active',
    imageUrl: data.imageUrl ?? null,
    aiConfidence: data.aiConfidence ?? 0,
    sensorValues: data.sensorValues ? JSON.stringify(data.sensorValues) : null,
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

export function updateFault(id: string, data: Partial<Fault>): Fault {
  getFault(id)

  const sets = UPDATABLE.filter((key) => data[key] !== undefined)
  if (sets.length === 0) return getFault(id)

  const columns = sets.map((key) => `${columnFor(key)} = @${key}`).join(', ')
  db.prepare(`UPDATE faults SET ${columns} WHERE id = @id`).run({
    id,
    ...sets.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = key === 'sensorValues' ? JSON.stringify(data[key]) : data[key]
      return acc
    }, {}),
  })
  return getFault(id)
}

function columnFor(key: string): string {
  const map: Record<string, string> = {
    stationId: 'station_id',
    trackId: 'track_id',
    faultType: 'fault_type',
    detectionTime: 'detection_time',
    imageUrl: 'image_url',
    aiConfidence: 'ai_confidence',
    sensorValues: 'sensor_values',
  }
  return map[key] ?? key
}

export function deleteFault(id: string): void {
  const result = db.prepare('DELETE FROM faults WHERE id = ?').run(id)
  if (result.changes === 0) throw new ApiError(404, `Fault '${id}' not found`)
}