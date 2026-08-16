import { Router } from 'express'
import authRoutes from './auth.routes.js'
import stationsRoutes from './stations.routes.js'
import tracksRoutes from './tracks.routes.js'
import faultsRoutes from './faults.routes.js'
import maintenanceRoutes from './maintenance.routes.js'
import notificationsRoutes from './notifications.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import devicesRoutes from './devices.routes.js'
import sensorReadingsRoutes from './sensorReadings.routes.js'
import alertsRoutes from './alerts.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/stations', stationsRoutes)
router.use('/tracks', tracksRoutes)
router.use('/faults', faultsRoutes)
router.use('/maintenance', maintenanceRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/devices', devicesRoutes)
router.use('/sensor-readings', sensorReadingsRoutes)
router.use('/alerts', alertsRoutes)

export default router