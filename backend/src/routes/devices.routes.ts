import { Router } from 'express'
import * as devices from '../services/devices.service.js'
import { authenticate, type AuthRequest, scopedStationId, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', authenticate, async (req: AuthRequest, res) => {
  res.json(await devices.listDevices(scopedStationId(req)))
})

router.get('/:id', async (req, res) => {
  res.json(await devices.getDevice(Number(req.params.id)))
})

router.post('/', authenticate, requireAdmin, async (req, res) => {
  res.status(201).json(await devices.createDevice(req.body ?? {}))
})

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid device id')
  res.json(await devices.updateDevice(id, req.body ?? {}))
})

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(400, 'Invalid device id')
  await devices.deleteDevice(id)
  res.status(204).end()
})

export default router