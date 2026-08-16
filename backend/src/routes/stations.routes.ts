import { Router } from 'express'
import * as stations from '../services/stations.service.js'
import { authenticate } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(stations.listStations())
})

router.get('/:id', (req, res) => {
  res.json(stations.getStation(String(req.params.id)))
})

router.post('/', authenticate, (req, res) => {
  res.status(201).json(stations.createStation(req.body ?? {}))
})

router.put('/:id', authenticate, (req, res) => {
  res.json(stations.updateStation(String(req.params.id), req.body ?? {}))
})

router.delete('/:id', authenticate, (req, res) => {
  stations.deleteStation(String(req.params.id))
  res.status(204).end()
})

export default router