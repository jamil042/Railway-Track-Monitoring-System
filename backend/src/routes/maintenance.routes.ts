import { Router } from 'express'
import * as maintenance from '../services/maintenance.service.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(maintenance.listTasks())
})

router.get('/:id', (req, res) => {
  res.json(maintenance.getTask(String(req.params.id)))
})

router.post('/', authenticate, (req, res) => {
  res.status(201).json(maintenance.createTask(req.body ?? {}))
})

router.put('/:id', authenticate, (req, res) => {
  res.json(maintenance.updateTask(String(req.params.id), req.body ?? {}))
})

router.delete('/:id', authenticate, (req, res) => {
  maintenance.deleteTask(String(req.params.id))
  res.status(204).end()
})

export default router