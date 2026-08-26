import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Firestore is the single source of truth. The service account key is loaded
 * from FIREBASE_SERVICE_ACCOUNT_PATH (recommended) or the default
 * GOOGLE_APPLICATION_CREDENTIALS lookup performed by the Admin SDK.
 */
function initFirebase(): App {
  const existing = getApps()
  if (existing.length > 0) return existing[0]!

  if (env.firebaseServiceAccountPath) {
    const keyPath = path.resolve(env.firebaseServiceAccountPath)
    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `Firebase service account key not found at ${keyPath}. ` +
          'Download it from Firebase Console > Project Settings > Service accounts and set FIREBASE_SERVICE_ACCOUNT_PATH.',
      )
    }
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8')) as {
      project_id: string
      client_email: string
      private_key: string
    }
    return initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    })
  }

  // Falls back to GOOGLE_APPLICATION_CREDENTIALS / metadata server.
  return initializeApp(env.firebaseProjectId ? { projectId: env.firebaseProjectId } : {})
}

let firestore: Firestore
try {
  initFirebase()
  const fb = getFirestore()
  // Firestore is lazy — force one tiny read so quota/auth errors surface NOW,
  // while we can still fall back to the in-memory store.
  await fb.collection('_health_probe').limit(1).get()
  firestore = fb
  console.log('[DB] Connected to Firebase Firestore')
} catch (err) {
  // Quota exhausted / credentials missing — run on the RTDB-mirrored store:
  // same tables, persisted in Realtime Database (NO per-op quota), so the
  // system keeps working AND data survives restarts.
  console.error(`[DB] Firebase unavailable: ${(err as Error).message}`)
  console.warn('[DB] Falling back to RTDB-MIRRORED storage (persistent, quota-free).')
  const { createRtdbMirrorFirestore } = await import('./rtdb_fallback.js')
  firestore = await createRtdbMirrorFirestore()
}

export { firestore }
export const COL = {
  stations: 'stations',
  tracks: 'tracks',
  users: 'users',
  faults: 'faults',
  maintenanceTasks: 'maintenance_tasks',
  notifications: 'notifications',
  devices: 'devices',
  sensorReadings: 'sensor_readings',
  alertLogs: 'alert_logs',
  counters: '_counters',
} as const

/**
 * Monotonic numeric id generator(transactional counter). Each
 * collection has a counter document in `_counters`; ids are allocated inside
 * a transaction so concurrent writers never collide.
 */
export async function nextId(collection: string): Promise<number> {
  const ref = firestore.collection(COL.counters).doc(collection)
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = ((snap.data()?.value as number | undefined) ?? 0) + 1
    tx.set(ref, { value: next })
    return next
  })
}

export interface CounterSnapshot {
  collection: string
  value: number
}

/** Highest id ever issued for a collection — used by the migration script to seed counters. */
export async function peekCounter(collection: string): Promise<number> {
  const snap = await firestore.collection(COL.counters).doc(collection).get()
  return (snap.data()?.value as number | undefined) ?? 0
}

export async function setCounter(collection: string, value: number): Promise<void> {
  await firestore.collection(COL.counters).doc(collection).set({ value })
}
