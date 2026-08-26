import { Router } from 'express'
import * as readings from '../services/sensorReadings.service.js'
import * as tracksService from '../services/tracks.service.js'
import { ApiError } from '../middleware/errorHandler.js'
import { authenticate, type AuthRequest, scopedStationId } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { deviceId, trackId, sensorType, limit } = req.query as Record<string, string | undefined>
  const stationId = scopedStationId(req) ?? undefined
  if (stationId && !trackId) {
    // Station scope: cache the track->station mapping for the readings filter
    const ts = await tracksService.listTracks(stationId)
    readings.rememberStationTracks(stationId, ts.map((t) => t.id))
  }
  res.json(
    await Promise.resolve(
      readings.listReadings({
        deviceId: deviceId ? Number(deviceId) : undefined,
        trackId,
        sensorType,
        stationId,
        limit: limit ? Number(limit) : undefined,
      }),
    ),
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