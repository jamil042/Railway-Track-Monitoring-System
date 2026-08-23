import { Router } from 'express'
import * as authService from '../services/auth.service.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.post('/login', (req, res) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string }
  if (!username || !password) throw new ApiError(400, 'username and password are required')
  res.json(authService.login(String(username), String(password)))
})

router.get('/me', authenticate, (req: AuthRequest, res) => {
  res.json({ user: authService.getUserById(req.user!.id) })
})

router.put('/profile', authenticate, (req: AuthRequest, res) => {
  const { name, email, stationId } = (req.body ?? {}) as { name?: string; email?: string; stationId?: string }
  const user = authService.updateProfile(req.user!.id, { name, email, stationId })
  // Fresh token issue kori jate updated name/role token-e thake
  res.json({ user, token: authService.signToken(user) })
})

router.put('/password', authenticate, (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = (req.body ?? {}) as { currentPassword?: string; newPassword?: string }
  if (!currentPassword || !newPassword) throw new ApiError(400, 'currentPassword and newPassword are required')
  authService.changePassword(req.user!.id, String(currentPassword), String(newPassword))
  res.json({ ok: true })
})

export default router