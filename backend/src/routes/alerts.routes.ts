import { Router } from 'express'
import * as alerts from '../services/alerts.service.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', async (_req, res) => {
  res.json(await alerts.listAlerts())
})

router.get('/:id', async (req, res) => {
  res.json(await alerts.getAlert(Number(req.params.id)))
})

router.post('/', authenticate, async (req, res) => {
  res.status(201).json(await alerts.createAlert(req.body ?? {}))
})

router.put('/:id/acknowledge', authenticate, async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid alert id')
  res.json(await alerts.acknowledgeAlert(id, req.user?.id))
})

export default router