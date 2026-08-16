import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { ApiError } from './errorHandler.js'

export interface AuthUser {
  id: number
  username: string
  role: string
  name: string
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