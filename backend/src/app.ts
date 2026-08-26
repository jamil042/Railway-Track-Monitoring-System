import express from 'express'
import cors from 'cors'
import routes from './routes/index.js'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { cacheMiddleware } from './middleware/cache.js'

export function createApp(): express.Express {
  const app = express()

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // Serve repeated GET polls from memory (1.5s TTL) — keeps Firestore read
  // quota usage tiny while the frontend still refreshes every 1.5s.
  app.use('/api', cacheMiddleware(1500), routes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}