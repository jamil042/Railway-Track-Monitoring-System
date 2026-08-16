import { Router } from 'express'
import * as faults from '../services/faults.service.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', (req, res) => {
  const { status, severity, stationId, search } = req.query as Record<string, string | undefined>
  res.json(faults.listFaults({ status, severity, stationId, search }))
})

router.get('/:id', (req, res) => {
  res.json(faults.getFault(String(req.params.id)))
})

router.post('/', authenticate, (req, res) => {
  res.status(201).json(faults.createFault(req.body ?? {}))
})

router.put('/:id', authenticate, (req, res) => {
  res.json(faults.updateFault(String(req.params.id), req.body ?? {}))
})

router.delete('/:id', authenticate, (req, res) => {
  faults.deleteFault(String(req.params.id))
  res.status(204).end()
})

export default router