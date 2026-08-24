import { Router } from 'express'
import * as readings from '../services/sensorReadings.service.js'
import { ApiError } from '../middleware/errorHandler.js'
import { authenticate, type AuthRequest, scopedStationId } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { deviceId, trackId, sensorType, limit } = req.query as Record<string, string | undefined>
  res.json(
    await readings.listReadings({
      deviceId: deviceId ? Number(deviceId) : undefined,
      trackId,
      sensorType,
      stationId: scopedStationId(req) ?? undefined,
      limit: limit ? Number(limit) : undefined,
    }),
  )
})

/**
 * Telemetry ingest endpoint. Public by design: on-device sensors (ESP32 /
 * Raspberry Pi) push readings here without an authenticated session.
 */
router.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>
  if (body.deviceId !== undefined && typeof body.deviceId !== 'number') {
    throw new ApiError(400, 'deviceId must be a number')
  }
  res.status(201).json(
    await readings.createReading({
      deviceId: body.deviceId as number,
      trackId: body.trackId as string,
      sensorType: body.sensorType as never,
      value: body.value as number,
      unit: body.unit as string,
      recordedAt: body.recordedAt as string,
    }),
  )
})

export default router