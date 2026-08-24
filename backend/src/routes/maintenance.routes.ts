import { Router } from 'express'
import * as maintenance from '../services/maintenance.service.js'
import { authenticate, type AuthRequest, scopedStationId, requireAdmin } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (req: AuthRequest, res) => {
  res.json(await maintenance.listTasks(scopedStationId(req)))
})

router.get('/:id', async (req, res) => {
  res.json(await maintenance.getTask(String(req.params.id)))
})

router.post('/', authenticate, requireAdmin, async (req, res) => {
  res.status(201).json(await maintenance.createTask(req.body ?? {}))
})

router.put('/:id', authenticate, async (req, res) => {
  res.json(await maintenance.updateTask(String(req.params.id), req.body ?? {}))
})

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await maintenance.deleteTask(String(req.params.id))
  res.status(204).end()
})

export default router