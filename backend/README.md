# Railway Track Monitoring — Backend

REST API for the AI-Assisted Smart Railway Track Monitoring and Early Warning
System. Built with **Node.js + Express + TypeScript + SQLite (better-sqlite3)**.

## Quick start

```bash
cd backend
npm install
npm run dev        # starts on http://localhost:5000
```

On first start the database (`data/railway.db`) is created from
`src/db/schema.sql` and seeded with the same demo data the frontend's
`src/data/mockData.ts` uses (stations, tracks, faults, maintenance, users,
devices, telemetry, alerts). Log in with:

| Username     | Password      | Role                  |
| ------------ | ------------- | --------------------- |
| `admin`      | `admin123`    | railway_administrator |
| `incharge`   | `incharge123` | station_incharge      |
| `maintenance`| `maint123`    | maintenance_team      |

To wipe and re-seed: `npm run seed`.

The frontend Vite dev server (port 8443) already proxies `/api` → port 5000, so
the UI can call the API with no extra configuration.

## Architecture

```
src/
├── server.ts               Entry point: initializes DB, seeds, starts HTTP server
├── app.ts                  Express app: CORS, JSON parsing, route mounting, error handling
├── config/
│   └── env.ts              Centralized configuration (PORT, DB_PATH, JWT_SECRET, ...)
├── db/
│   ├── index.ts            SQLite connection + schema init (PRAGMA foreign_keys = ON)
│   ├── schema.sql          Database schema (tables, indexes, views, triggers)
│   └── seed.ts             Demo/seed data loader
├── types/
│   └── index.ts            Shared TypeScript types (mirrors frontend types)
├── middleware/
│   ├── auth.ts             JWT verification for protected routes
│   └── errorHandler.ts     Centralized ApiError + SQLite constraint handling
├── routes/                 HTTP layer: define endpoints, call services, respond JSON
│   └── index.ts            Mounts every resource router under /api
└── services/               Data layer: SQL queries + business logic
```

**Layering:** `routes` → `services` → `db`. Routes never touch SQL directly;
services never touch HTTP. This keeps each layer small and testable.

## Data model

9 tables (see `src/db/schema.sql` for full DDL with FK rules and CHECK
constraints):

- `stations`, `tracks` — infrastructure master data
- `faults`, `maintenance_tasks`, `notifications`, `users` — fault domain
- `devices`, `sensor_readings`, `alert_logs` — hardware/telemetry domain

Key behaviors:

- Foreign keys are enforced (`PRAGMA foreign_keys = ON`, per connection).
- `tracks.temperature/vibration/displacement` are **cached latest readings**,
  auto-refreshed by the `trg_track_latest_reading` trigger whenever a new
  `sensor_readings` row is inserted. History stays in `sensor_readings`.
- Aggregates (active fault counts, dashboard stats, chart datasets) are computed
  in SQL views, never stored, so they can't go stale.

## API reference

All endpoints are under `/api`. **Protected** endpoints require
`Authorization: Bearer <token>` from `POST /api/auth/login`. Read-only GET
endpoints and telemetry ingest are public.

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/auth/login` | Login, returns `{ token, user }` |
| GET | `/auth/me` | Current user (protected) |
| GET | `/stations` | List stations (with active fault counts) |
| GET / POST / PUT / DELETE | `/stations/:id` | Station CRUD (writes protected) |
| GET / POST / PUT / DELETE | `/tracks/:id` | Track CRUD |
| GET | `/faults?status=&severity=&stationId=&search=` | List faults (filterable) |
| GET / POST / PUT / DELETE | `/faults/:id` | Fault CRUD |
| GET / POST / PUT / DELETE | `/maintenance/:id` | Maintenance task CRUD |
| GET / POST | `/notifications` | List / create notifications |
| PUT | `/notifications/:id/read` | Mark notification read |
| GET | `/dashboard/stats` | Headline dashboard stats |
| GET | `/dashboard/fault-trend` | Daily fault/fixed trend |
| GET | `/dashboard/fault-by-type` | Faults grouped by type |
| GET | `/dashboard/monthly-stats` | Monthly aggregates |
| GET | `/dashboard/fault-by-station` | Faults per station |
| GET / POST / PUT / DELETE | `/devices/:id` | Hardware device CRUD |
| GET | `/sensor-readings?deviceId=&trackId=&sensorType=&limit=` | Telemetry history |
| POST | `/sensor-readings` | **Telemetry ingest** (public — ESP32/Pi push here) |
| GET / POST | `/alerts` | LoRa alert log |
| PUT | `/alerts/:id/acknowledge` | Acknowledge an alert (protected) |
| GET | `/health` | Liveness check |

## Configuration

Copy `.env.example` to `.env` and adjust. Defaults work out of the box:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `5000` | HTTP port |
| `DB_PATH` | `data/railway.db` | SQLite file path |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CORS_ORIGIN` | `*` | Allowed frontend origin |