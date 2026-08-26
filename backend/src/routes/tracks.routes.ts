import { Router } from 'express'
import * as tracksService from '../services/tracks.service.js'
import { authenticate, type AuthRequest, scopedStationId, requireAdmin } from '../middleware/auth.js'

const router = Router()

// Public device-facing endpoint: sensors/simulators fetch track IDs
// without an authenticated session (same trust model as ingest).
router.get('/ids', async (_req, res) => {
  const tracks = await tracksService.listTracks(null)
  res.json(tracks.map((t: { id: string }) => t.id))
})

// Non-admin users only see their own station's tracks
router.get('/', authenticate, async (req: AuthRequest, res) => {
  res.json(await tracksService.listTracks(scopedStationId(req)))
})

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  res.json(await tracksService.getTrack(String(req.params.id)))
})

router.post('/', authenticate, requireAdmin, async (req, res) => {
  res.status(201).json(await tracksService.createTrack(req.body ?? {}))
})

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  res.json(await tracksService.updateTrack(String(req.params.id), req.body ?? {}))
})

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await tracksService.deleteTrack(String(req.params.id))
  res.status(204).end()
})

export default router
