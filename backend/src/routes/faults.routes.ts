import { Router } from 'express'
import * as faults from '../services/faults.service.js'
import { authenticate, type AuthRequest, scopedStationId, requireAdmin, requireFaultUpdater } from '../middleware/auth.js'

const router = Router()

// Non-admin users only see their own station's faults
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { status, severity, search } = req.query as Record<string, string | undefined>
  const stationId = scopedStationId(req) ?? (req.query.stationId as string | undefined)
  res.json(await faults.listFaults({ status, severity, stationId: stationId ?? undefined, search }))
})

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  res.json(await faults.getFault(String(req.params.id)))
})

// Fault creation happens from the sensor pipeline (authenticates with admin
// token). stationId "AUTO" = route to the currently active station
// (sob shesh je station user login korse) — single-device demo mode.
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const body = { ...(req.body ?? {}) }
  if (body.stationId === 'AUTO') {
    const { getActiveStation, firstTrackOfStation } = await import('../services/session.js')
    const stationId = getActiveStation()
    body.stationId = stationId
    if (!body.trackId) body.trackId = firstTrackOfStation(stationId)
  }
  res.status(201).json(await faults.createFault(body))
})

// Maintenance Team + Admin can update fault status; Station Incharge cannot.
router.put('/:id', authenticate, requireFaultUpdater, async (req: AuthRequest, res) => {
  const stationId = scopedStationId(req)
  const fault = await faults.getFault(String(req.params.id))
  if (stationId && fault.stationId !== stationId) {
    res.status(403).json({ error: 'This fault belongs to another station' })
    return
  }
  // Maintenance team can only change status/severity/remarks — not core fields
  const body = { ...req.body }
  if (req.user?.role === 'maintenance_team') {
    const allowed: Record<string, unknown> = {}
    for (const k of ['status', 'severity', 'remarks'] as const) {
      if (body[k] !== undefined) allowed[k] = body[k]
    }
    return void res.json(await faults.updateFault(String(req.params.id), allowed))
  }
  res.json(await faults.updateFault(String(req.params.id), body))
})

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await faults.deleteFault(String(req.params.id))
  res.status(204).end()
})

export default router
