import { db } from '../db/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { AlertLog } from '../types/index.js'

const SELECT = `
  SELECT id, fault_id AS faultId, device_id AS deviceId, destination, channel,
         message, severity, sent_at AS sentAt, acknowledged_at AS acknowledgedAt,
         acknowledged_by AS acknowledgedBy
  FROM alert_logs`

export function listAlerts(): AlertLog[] {
  return db.prepare(`${SELECT} ORDER BY sentAt DESC`).all() as AlertLog[]
}

export function getAlert(id: number): AlertLog {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as AlertLog | undefined
  if (!row) throw new ApiError(404, `Alert #${id} not found`)
  return row
}

export function createAlert(data: Partial<AlertLog>): AlertLog {
  if (!data.faultId || !data.destination) {
    throw new ApiError(400, 'faultId and destination are required')
  }
  const result = db
    .prepare(
      `INSERT INTO alert_logs (fault_id, device_id, destination, channel, message, severity, sent_at, acknowledged_at, acknowledged_by)
       VALUES (@faultId, @deviceId, @destination, @channel, @message, @severity, @sentAt, @acknowledgedAt, @acknowledgedBy)`,
    )
    .run({
      faultId: data.faultId,
      deviceId: data.deviceId ?? null,
      destination: data.destination,
      channel: data.channel ?? 'lora',
      message: data.message ?? '',
      severity: data.severity ?? 'medium',
      sentAt: data.sentAt ?? new Date().toISOString(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    })
  return getAlert(Number(result.lastInsertRowid))
}

export function acknowledgeAlert(id: number, acknowledgedBy?: number): AlertLog {
  getAlert(id)
  db.prepare('UPDATE alert_logs SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ?').run(
    new Date().toISOString(),
    acknowledgedBy ?? null,
    id,
  )
  return getAlert(id)
}