import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore, nextId } from '../db/index.js'
import type { Notification } from '../types/index.js'

interface NotificationDoc extends Omit<Notification, 'id' | 'read'> {
  userId: number | null
  read: boolean
}

function toNotification(id: string, d: FirebaseFirestore.DocumentData): Notification {
  return { ...d, id: String(id), read: Boolean(d.read) } as unknown as Notification
}

export async function listNotifications(userId?: number): Promise<Notification[]> {
  const snap = await firestore.collection(COL.notifications).get()
  return snap.docs
    .map((d) => toNotification(d.id, d.data()))
    .filter((n) => (n as unknown as NotificationDoc).userId == null || (n as unknown as NotificationDoc).userId === userId)
    .sort((a, b) => (a.time < b.time ? 1 : -1))
}

export async function createNotification(data: Partial<Notification> & { userId?: number }): Promise<Notification> {
  const id = await nextId(COL.notifications)
  const doc: NotificationDoc = {
    userId: data.userId ?? null,
    title: data.title ?? '',
    message: data.message ?? '',
    type: data.type ?? 'info',
    time: data.time ?? new Date().toISOString(),
    read: Boolean(data.read),
  } as NotificationDoc
  await firestore.collection(COL.notifications).doc(String(id)).set(doc)
  return toNotification(String(id), doc as unknown as FirebaseFirestore.DocumentData)
}

async function requireNotification(id: number): Promise<FirebaseFirestore.DocumentSnapshot> {
  const snap = await firestore.collection(COL.notifications).doc(String(id)).get()
  if (!snap.exists) throw new ApiError(404, `Notification #${id} not found`)
  return snap
}

export async function getNotification(id: number): Promise<Notification> {
  const snap = await requireNotification(id)
  return toNotification(snap.id, snap.data()!)
}

export async function markRead(id: number, read = true): Promise<Notification> {
  await requireNotification(id)
  await firestore.collection(COL.notifications).doc(String(id)).update({ read })
  return getNotification(id)
}

export async function deleteNotification(id: number): Promise<void> {
  await requireNotification(id)
  await firestore.collection(COL.notifications).doc(String(id)).delete()
}
