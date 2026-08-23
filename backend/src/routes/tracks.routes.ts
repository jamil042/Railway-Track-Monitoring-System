import { Router } from 'express'
import * as tracks from '../services/tracks.service.js'
import { authenticate, type AuthRequest, scopedStationId, requireAdmin } from '../middleware/auth.js'

const router = Router()

// Non-admin users only see their own station's tracks
router.get('/', authenticate, (req: AuthRequest, res) => {
  res.json(tracks.listTracks(scopedStationId(req)))
})

router.get('/:id', authenticate, (req: AuthRequest, res) => {
  res.json(tracks.getTrack(String(req.params.id)))
})

router.post('/', authenticate, requireAdmin, (req, res) => {
  res.status(201).json(tracks.createTrack(req.body ?? {}))
})

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  res.json(tracks.updateTrack(String(req.params.id), req.body ?? {}))
})

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  tracks.deleteTrack(String(req.params.id))
  res.status(204).end()
})

export default router
