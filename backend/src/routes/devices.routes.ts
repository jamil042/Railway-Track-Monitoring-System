import { Router } from 'express'
import * as devices from '../services/devices.service.js'
import { authenticate, type AuthRequest, scopedStationId, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', authenticate, (req: AuthRequest, res) => {
  res.json(devices.listDevices(scopedStationId(req)))
})

router.get('/:id', (req, res) => {
  res.json(devices.getDevice(Number(req.params.id)))
})

router.post('/', authenticate, requireAdmin, (req, res) => {
  res.status(201).json(devices.createDevice(req.body ?? {}))
})

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid device id')
  res.json(devices.updateDevice(id, req.body ?? {}))
})

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid device id')
  devices.deleteDevice(id)
  res.status(204).end()
})

export default router