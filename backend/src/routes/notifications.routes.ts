import { Router } from 'express'
import * as notifications from '../services/notifications.service.js'
import { authenticate } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(notifications.listNotifications())
})

router.post('/', authenticate, (req, res) => {
  res.status(201).json(notifications.createNotification(req.body ?? {}))
})

router.put('/:id/read', authenticate, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid notification id')
  res.json(notifications.markRead(id))
})

router.delete('/:id', authenticate, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid notification id')
  notifications.deleteNotification(id)
  res.status(204).end()
})

export default router