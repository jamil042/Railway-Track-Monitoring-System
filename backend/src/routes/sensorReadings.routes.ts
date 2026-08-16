import { Router } from 'express'
import * as readings from '../services/sensorReadings.service.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', (req, res) => {
  const { deviceId, trackId, sensorType, limit } = req.query as Record<string, string | undefined>
  res.json(
    readings.listReadings({
      deviceId: deviceId ? Number(deviceId) : undefined,
      trackId,
      sensorType,
      limit: limit ? Number(limit) : undefined,
    }),
  )
})

/**
 * Telemetry ingest endpoint. Public by design: on-device sensors (ESP32 /
 * Raspberry Pi) push readings here without an authenticated session.
 */
router.post('/', (req, res) => {
  const body = req.body as Record<string, unknown>
  if (body.deviceId !== undefined && typeof body.deviceId !== 'number') {
    throw new ApiError(400, 'deviceId must be a number')
  }
  res.status(201).json(
    readings.createReading({
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