import { Router } from 'express'
import * as tracks from '../services/tracks.service.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(tracks.listTracks())
})

router.get('/:id', (req, res) => {
  res.json(tracks.getTrack(String(req.params.id)))
})

router.post('/', authenticate, (req, res) => {
  res.status(201).json(tracks.createTrack(req.body ?? {}))
})

router.put('/:id', authenticate, (req, res) => {
  res.json(tracks.updateTrack(String(req.params.id), req.body ?? {}))
})

router.delete('/:id', authenticate, (req, res) => {
  tracks.deleteTrack(String(req.params.id))
  res.status(204).end()
})

export default router