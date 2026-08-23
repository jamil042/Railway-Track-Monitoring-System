import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { ApiError } from './errorHandler.js'

export interface AuthUser {
  id: number
  username: string
  role: string
  name: string
  stationId?: string | null
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

/**
 * Guards protected routes. Requires a `Bearer <token>` header issued by
 * POST /api/auth/login. Attaches the decoded user to `req.user`.
 */
export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined

  if (!token) throw new ApiError(401, 'Authentication required')

  try {
    req.user = jwt.verify(token, env.jwtSecret) as AuthUser
    next()
  } catch {
    throw new ApiError(401, 'Invalid or expired token')
  }
}

/** Non-admin users are scoped to their own station's data. */
export function scopedStationId(req: AuthRequest): string | null {
  if (!req.user) return null
  return req.user.role === 'railway_administrator' ? null : (req.user.stationId ?? '__none__')
}

/** Admin-only mutations. */
export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'railway_administrator') {
    throw new ApiError(403, 'Only Railway Administrator can perform this action')
  }
  next()
}

/**
 * Fault status update permission: maintenance_team and admin only.
 * Station incharge can view faults but cannot change their status.
 */
export function requireFaultUpdater(req: AuthRequest, _res: Response, next: NextFunction): void {
  const role = req.user?.role
  if (role !== 'maintenance_team' && role !== 'railway_administrator') {
    throw new ApiError(403, 'Only Maintenance Team can update fault status')
  }
  next()
}