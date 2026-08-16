import { Router } from 'express'
import * as alerts from '../services/alerts.service.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(alerts.listAlerts())
})

router.get('/:id', (req, res) => {
  res.json(alerts.getAlert(Number(req.params.id)))
})

router.post('/', authenticate, (req, res) => {
  res.status(201).json(alerts.createAlert(req.body ?? {}))
})

router.put('/:id/acknowledge', authenticate, (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid alert id')
  res.json(alerts.acknowledgeAlert(id, req.user?.id))
})

export default router