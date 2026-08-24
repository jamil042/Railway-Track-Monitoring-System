import { Router } from 'express'
import * as notifications from '../services/notifications.service.js'
import { authenticate } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', async (_req, res) => {
  res.json(await notifications.listNotifications())
})

router.post('/', authenticate, async (req, res) => {
  res.status(201).json(await notifications.createNotification(req.body ?? {}))
})

router.put('/:id/read', authenticate, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid notification id')
  res.json(await notifications.markRead(id))
})

router.delete('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid notification id')
  await notifications.deleteNotification(id)
  res.status(204).end()
})

export default router