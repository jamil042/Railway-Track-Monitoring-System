import { Router } from 'express'
import * as dashboard from '../services/dashboard.service.js'

const router = Router()

router.get('/stats', (_req, res) => {
  res.json(dashboard.getStats())
})

router.get('/fault-trend', (_req, res) => {
  res.json(dashboard.getFaultTrend())
})

router.get('/fault-by-type', (_req, res) => {
  res.json(dashboard.getFaultByType())
})

router.get('/monthly-stats', (_req, res) => {
  res.json(dashboard.getMonthlyStats())
})

router.get('/fault-by-station', (_req, res) => {
  res.json(dashboard.getFaultByStation())
})

export default router