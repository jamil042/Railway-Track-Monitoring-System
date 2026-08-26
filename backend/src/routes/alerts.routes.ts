import { Router } from 'express'
import * as alerts from '../services/alerts.service.js'
import { authenticate, type AuthRequest, scopedStationId } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

// Station users see only their station's alerts; admin sees all.
router.get('/', authenticate, async (req: AuthRequest, res) => {
  res.json(await alerts.listAlerts(scopedStationId(req)))
})

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  res.json(await alerts.getAlert(Number(req.params.id)))
})

router.post('/', authenticate, async (req, res) => {
  const body = { ...(req.body ?? {}) }
  if (body.stationId === 'AUTO') {
    const { getActiveStation } = await import('../services/session.js')
    body.stationId = getActiveStation()
  }
  res.status(201).json(await alerts.createAlert(body))
})

router.put('/:id/acknowledge', authenticate, async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid alert id')
  res.json(await alerts.acknowledgeAlert(id, req.user?.id))
})

export default router