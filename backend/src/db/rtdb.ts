import { cert, initializeApp, getApps, type App } from 'firebase-admin/app'
import { getDatabase, type Database } from 'firebase-admin/database'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'
import { createMemoryRtdb, type MemoryRtdb } from './memory.rtdb.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Firebase Realtime Database access for high-frequency sensor telemetry.
 * Unlike Firestore, RTDB has NO per-operation read/write limits — only
 * storage + bandwidth (GB/month), which tiny sensor JSON payloads barely
 * touch. This keeps the 1.5s live pipeline safely inside the free plan.
 *
 * If RTDB is unreachable (e.g. not yet created in the console) we fall back
 * to an in-memory store so the system keeps running.
 */

function projectId(): string {
  if (env.firebaseProjectId) return env.firebaseProjectId
  const keyPath = env.firebaseServiceAccountPath
  if (keyPath && fs.existsSync(path.resolve(keyPath))) {
    const json = JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf-8')) as { project_id: string }
    return json.project_id
  }
  throw new Error('Cannot determine Firebase project id for Realtime Database')
}

let db: Database | MemoryRtdb
let usingMemory = false

try {
  const url = process.env.FIREBASE_RTDB_URL ?? `https://${projectId()}-default-rtdb.firebaseio.com`
  // RTDB needs the URL set at app-creation time, so use a dedicated app.
  const keyPath = env.firebaseServiceAccountPath
  const credential = keyPath
    ? cert(JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf-8')))
    : undefined
  const app = initializeApp({ credential, databaseURL: url }, 'rtdb-app')
  db = getDatabase(app)
  // Force one tiny round-trip so connection errors surface immediately.
  // (Timeout guards against instances that don't exist yet — those hang.)
  const probe = (async () => {
    await db.ref('_health_probe').set({ at: Date.now() })
    await db.ref('_health_probe').remove()
  })()
  await Promise.race([
    probe,
    new Promise((_, rej) => setTimeout(() => rej(new Error('probe timed out')), 8000)),
  ])
  console.log(`[DB] Realtime Database connected (${url})`)
} catch (err) {
  console.error(`[DB] Realtime Database unavailable: ${(err as Error).message}`)
  console.warn('[DB] Telemetry falls back to IN-MEMORY storage. Data will reset on restart.')
  db = createMemoryRtdb()
  usingMemory = true
}

export function isTelemetryInMemory(): boolean {
  return usingMemory
}

/** Max readings kept per track — older ones are pruned automatically. */
export const MAX_READINGS_PER_TRACK = 50

export const rtdb = db

// ---- Node paths -----------------------------------------------------------

export const PATHS = {
  /** Latest reading per (device, track, sensorType): overwrite-style docs. */
  latest: 'sensor_latest',
  /** Per-track history list, capped at MAX_READINGS_PER_TRACK entries. */
  history: 'sensor_history',
  /** Live computed values per track (status/health/EMA baselines). */
  live: 'tracks_live',
}
