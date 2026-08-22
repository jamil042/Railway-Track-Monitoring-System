import { initDatabase } from './db/index.js'
import { seedDatabase } from './db/seed.js'
import { createApp } from './app.js'
import { env } from './config/env.js'

initDatabase()
seedDatabase()

const app = createApp()

app.listen(env.port, '0.0.0.0', () => {
  console.log(`Railway Track Monitoring API listening on http://0.0.0.0:${env.port}`)
  console.log(`Health check: http://localhost:${env.port}/api/health`)
})