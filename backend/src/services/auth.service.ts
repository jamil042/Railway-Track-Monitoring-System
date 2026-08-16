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
  const token = jwt.sign(
    { id: row.id, username: row.username, role: row.role, name: row.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  )
  return { token, user }
}

export function getUserById(id: number): User {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw new ApiError(404, 'User not found')
  return toUser(row)
}