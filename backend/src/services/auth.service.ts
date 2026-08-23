import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db/index.js'
import { env } from '../config/env.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { User } from '../types/index.js'

interface UserRow {
  id: number
  username: string
  password_hash: string
  name: string
  role: User['role']
  email: string | null
  avatar: string | null
  station_id: string | null
}

function toUser(row: UserRow): User {
  const station = row.station_id
    ? (db.prepare('SELECT name FROM stations WHERE id = ?').get(row.station_id) as { name: string } | undefined)
    : undefined
  return {
    id: String(row.id),
    username: row.username,
    name: row.name,
    role: row.role,
    email: row.email ?? undefined,
    avatar: row.avatar ?? undefined,
    station: station?.name,
  }
}

export function login(username: string, password: string): { token: string; user: User } {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new ApiError(401, 'Invalid username or password')
  }

  const user = toUser(row)
  return { token: signToken(user), user }
}

export function signToken(user: User): string {
  return jwt.sign(
    { id: Number(user.id), username: user.username, role: user.role, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  )
}

export function getUserById(id: number): User {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw new ApiError(404, 'User not found')
  return toUser(row)
}

export function updateProfile(
  id: number,
  data: { name?: string; email?: string; stationId?: string },
): User {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw new ApiError(404, 'User not found')

  const sets: string[] = []
  const params: Record<string, unknown> = { id }
  if (data.name?.trim()) {
    sets.push('name = @name')
    params.name = data.name.trim()
  }
  if (data.email !== undefined) {
    sets.push('email = @email')
    params.email = data.email.trim() || null
  }
  if (data.stationId !== undefined) {
    sets.push('station_id = @stationId')
    params.stationId = data.stationId || null
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(params)
  }
  return getUserById(id)
}

export function changePassword(id: number, currentPassword: string, newPassword: string): void {
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters')
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw new ApiError(404, 'User not found')
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    throw new ApiError(401, 'Current password is incorrect')
  }
  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = @hash WHERE id = @id').run({ hash, id })
}