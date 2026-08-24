import { Router } from 'express'
import * as stations from '../services/stations.service.js'
import { authenticate, type AuthRequest, scopedStationId, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', authenticate, async (req: AuthRequest, res) => {
  res.json(await stations.listStations(scopedStationId(req)))
})

router.get('/:id', async (req, res) => {
  res.json(await stations.getStation(String(req.params.id)))
})

router.post('/', authenticate, requireAdmin, async (req, res) => {
  res.status(201).json(await stations.createStation(req.body ?? {}))
})

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  res.json(await stations.updateStation(String(req.params.id), req.body ?? {}))
})

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await stations.deleteStation(String(req.params.id))
  res.status(204).end()
})

export default router