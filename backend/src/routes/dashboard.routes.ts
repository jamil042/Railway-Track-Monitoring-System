import { Router } from 'express'
import * as dashboard from '../services/dashboard.service.js'
import { authenticate, type AuthRequest, scopedStationId } from '../middleware/auth.js'

const router = Router()

// Non-admin users get station-scoped stats — they only ever see their own station.
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  res.json(await dashboard.getStats(scopedStationId(req)))
})

router.get('/fault-trend', authenticate, async (req: AuthRequest, res) => {
  res.json(await dashboard.getFaultTrend(scopedStationId(req)))
})

router.get('/fault-by-type', authenticate, async (req: AuthRequest, res) => {
  res.json(await dashboard.getFaultByType(scopedStationId(req)))
})

router.get('/monthly-stats', authenticate, async (req: AuthRequest, res) => {
  res.json(await dashboard.getMonthlyStats(scopedStationId(req)))
})

router.get('/fault-by-station', authenticate, async (req: AuthRequest, res) => {
  res.json(await dashboard.getFaultByStation(scopedStationId(req)))
})

export default router
