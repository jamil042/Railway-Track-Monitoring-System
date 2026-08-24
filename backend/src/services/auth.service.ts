import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ApiError } from '../middleware/errorHandler.js'
import { COL, firestore } from '../db/index.js'
import { env } from '../config/env.js'
import type { User } from '../types/index.js'

interface UserDoc {
  username: string
  passwordHash: string
  name: string
  role: User['role']
  email: string | null
  avatar?: string | null
  stationId: string | null
}

function toUser(id: string, d: FirebaseFirestore.DocumentData): User {
  return {
    id,
    username: d.username,
    name: d.name,
    role: d.role,
    email: d.email ?? undefined,
    avatar: d.avatar ?? undefined,
    stationId: d.stationId ?? undefined,
  }
}

async function findUserRow(row: {
  byUsername?: string
  byStationRole?: { stationId: string; role: string }
}): Promise<{ id: string; doc: UserDoc } | undefined> {
  let q = firestore.collection(COL.users) as FirebaseFirestore.Query
  if (row.byUsername) q = q.where('username', '==', row.byUsername)
  if (row.byStationRole) {
    q = q.where('stationId', '==', row.byStationRole.stationId).where('role', '==', row.byStationRole.role)
  }
  const snap = await q.limit(1).get()
  if (snap.empty) return undefined
  const d = snap.docs[0]!
  return { id: d.id, doc: d.data() as UserDoc }
}

export async function login(
  role: string,
  username: string | null,
  stationId: string | null,
  password: string,
): Promise<{ token: string; user: User }> {
  let found: { id: string; doc: UserDoc } | undefined

  if (role === 'railway_administrator') {
    found = await findUserRow({ byUsername: username ?? '' })
  } else if (role === 'station_incharge' || role === 'maintenance_team') {
    found = await findUserRow({ byStationRole: { stationId: stationId ?? '', role } })
  } else {
    throw new ApiError(400, 'Invalid role')
  }

  if (!found || !bcrypt.compareSync(password, found.doc.passwordHash)) {
    throw new ApiError(401, 'Invalid credentials. Please check and try again.')
  }

  const user = toUser(found.id, found.doc as unknown as FirebaseFirestore.DocumentData)
  return { token: signToken(user), user }
}

export function signToken(user: User): string {
  return jwt.sign(
    { id: Number(user.id), username: user.username, role: user.role, name: user.name, stationId: user.stationId },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  )
}

async function requireUserRow(id: number | string): Promise<FirebaseFirestore.QueryDocumentSnapshot> {
  const snap = await firestore.collection(COL.users).doc(String(id)).get()
  if (!snap.exists) throw new ApiError(404, 'User not found')
  return snap as FirebaseFirestore.QueryDocumentSnapshot
}

export async function getUserById(id: number): Promise<User> {
  const snap = await requireUserRow(id)
  const user = toUser(snap.id, snap.data())
  if (user.stationId) {
    const station = await firestore.collection(COL.stations).doc(user.stationId).get()
    if (station.exists) user.station = station.data()?.name
  }
  return user
}

export async function updateProfile(
  id: number,
  data: { name?: string; email?: string; stationId?: string },
): Promise<User> {
  await requireUserRow(id)

  const updates: Record<string, unknown> = {}
  if (data.name?.trim()) updates.name = data.name.trim()
  if (data.email !== undefined) updates.email = data.email.trim() || null
  if (data.stationId !== undefined) updates.stationId = data.stationId || null

  if (Object.keys(updates).length > 0) {
    await firestore.collection(COL.users).doc(String(id)).update(updates)
  }
  return getUserById(id)
}

export async function changePassword(id: number, currentPassword: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters')
  }
  const snap = await requireUserRow(id)
  const row = snap.data() as UserDoc
  if (!bcrypt.compareSync(currentPassword, row.passwordHash)) {
    throw new ApiError(401, 'Current password is incorrect')
  }
  await snap.ref.update({ passwordHash: bcrypt.hashSync(newPassword, 10) })
}
