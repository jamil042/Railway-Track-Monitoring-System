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

export default router