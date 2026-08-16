import { db } from '../db/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { Notification } from '../types/index.js'

export function listNotifications(userId?: number): Notification[] {
  const rows = db
    .prepare(
      `SELECT id, title, message, type, time, read
       FROM notifications
       WHERE user_id IS NULL OR user_id = @userId
       ORDER BY time DESC`,
    )
    .all({ userId: userId ?? -1 }) as Notification[]
  return rows.map((n) => ({ ...n, read: Boolean(n.read), id: String(n.id) }))
}

export function createNotification(data: Partial<Notification> & { userId?: number }): Notification {
  const result = db
    .prepare(
      `INSERT INTO notifications (user_id, title, message, type, time, read)
       VALUES (@userId, @title, @message, @type, @time, @read)`,
    )
    .run({
      userId: data.userId ?? null,
      title: data.title ?? '',
      message: data.message ?? '',
      type: data.type ?? 'info',
      time: data.time ?? new Date().toISOString(),
      read: data.read ? 1 : 0,
    })
  return getNotification(Number(result.lastInsertRowid))
}

export function getNotification(id: number): Notification {
  const row = db.prepare('SELECT id, title, message, type, time, read FROM notifications WHERE id = ?').get(id) as
    | Notification
    | undefined
  if (!row) throw new ApiError(404, `Notification #${id} not found`)
  return { ...row, read: Boolean(row.read), id: String(row.id) }
}

export function markRead(id: number, read = true): Notification {
  getNotification(id)
  db.prepare('UPDATE notifications SET read = ? WHERE id = ?').run(read ? 1 : 0, id)
  return getNotification(id)
}

export function deleteNotification(id: number): void {
  const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id)
  if (result.changes === 0) throw new ApiError(404, `Notification #${id} not found`)
}