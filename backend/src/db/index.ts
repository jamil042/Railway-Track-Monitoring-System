import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const dbFile = path.resolve(env.dbPath)
fs.mkdirSync(path.dirname(dbFile), { recursive: true })

/**
 * Single shared SQLite connection. better-sqlite3 is synchronous, so the
 * whole application uses one connection safely.
 */
export const db = new Database(dbFile)
db.pragma('foreign_keys = ON')

/**
 * Creates the database file (and folder) on first run and applies the schema
 * if it has not been applied yet. Safe to call on every startup.
 */
export function initDatabase(): void {

  const hasStationsTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'stations'")
    .get()

  if (!hasStationsTable) {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
    db.exec(schema)
  }
}