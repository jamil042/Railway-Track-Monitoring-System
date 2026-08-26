import type { NextFunction, Request, Response } from 'express'

interface CacheEntry {
  body: unknown
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

/**
 * In-memory response cache for GET requests. Repeated polls (frontend live
 * refresh every ~1.5s) are served from memory instead of hitting Firestore,
 * keeping read quota usage minimal. TTL should be <= frontend poll interval
 * so data still feels live.
 */
export function cacheMiddleware(ttlMs = 1500) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') return next()

    // Auth-scoped routes vary by user; include auth header in key so
    // different stations never see each other's cached data.
    const key = `${req.originalUrl}|${req.headers.authorization ?? ''}`
    const hit = store.get(key)
    if (hit && hit.expiresAt > Date.now()) {
      res.json(hit.body)
      return
    }

    const origJson = res.json.bind(res)
    res.json = ((body: unknown) => {
      if (res.statusCode === 200) {
        store.set(key, { body, expiresAt: Date.now() + ttlMs })
        if (store.size > 500) {
          const now = Date.now()
          for (const [k, v] of store) {
            if (v.expiresAt < now) store.delete(k)
          }
        }
      }
      return origJson(body)
    }) as typeof res.json

    next()
  }
}
