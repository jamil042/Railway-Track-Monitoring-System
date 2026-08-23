import { Router } from 'express'
import * as dashboard from '../services/dashboard.service.js'
import { authenticate, type AuthRequest, scopedStationId } from '../middleware/auth.js'

const router = Router()

// Non-admin users get station-scoped stats — they only ever see their own station.
router.get('/stats', authenticate, (req: AuthRequest, res) => {
  res.json(dashboard.getStats(scopedStationId(req)))
})

router.get('/fault-trend', authenticate, (req: AuthRequest, res) => {
  res.json(dashboard.getFaultTrend(scopedStationId(req)))
})

router.get('/fault-by-type', authenticate, (req: AuthRequest, res) => {
  res.json(dashboard.getFaultByType(scopedStationId(req)))
})

router.get('/monthly-stats', authenticate, (req: AuthRequest, res) => {
  res.json(dashboard.getMonthlyStats(scopedStationId(req)))
})

router.get('/fault-by-station', authenticate, (req: AuthRequest, res) => {
  res.json(dashboard.getFaultByStation(scopedStationId(req)))
})

export default router
