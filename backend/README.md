# Railway Track Monitoring — Backend

REST API for the AI-Assisted Smart Railway Track Monitoring and Early Warning
System. Built with **Node.js + Express + TypeScript + Firebase Firestore**.

## Quick start

```bash
cd backend
npm install
npm run dev        # starts on http://localhost:5000
```

On first start the app connects to Firestore and seeds it if empty
(stations, tracks, users, devices). Log in with:

| Username / Station ID | Password   | Role                  |
| --------------------- | ---------- | --------------------- |
| `admin`               | `admin123` | railway_administrator |
| `ST01`–`ST12`         | `12345`    | station_incharge      |
| `ST01`–`ST12`         | `12345`    | maintenance_team      |

To wipe and re-seed: `npm run seed`.

The frontend Vite dev server (port 8443) already proxies `/api` → port 5000, so
the UI can call the API with no extra configuration.

## Architecture

```
src/
├── server.ts               Entry point: connects to Firestore, seeds, starts HTTP server
├── app.ts                  Express app: CORS, JSON parsing, route mounting, error handling
├── config/
│   └── env.ts              Centralized configuration (PORT, FIREBASE_*, JWT_SECRET, ...)
├── db/
│   ├── index.ts            Firebase Admin SDK init + Firestore client + id counters
│   └── seed.ts             Seed data loader
├── types/
│   └── index.ts            Shared TypeScript types (mirrors frontend types)
├── middleware/
│   ├── auth.ts             JWT verification for protected routes
│   └── errorHandler.ts     Centralized ApiError + Firestore error handling
├── routes/                 HTTP layer: define endpoints, call services, respond JSON
│   └── index.ts            Mounts every resource router under /api
└── services/               Data layer: Firestore queries + business logic
```

**Layering:** `routes` → `services` → `db`. Routes never touch Firestore directly;
services never touch HTTP. This keeps each layer small and testable.

## Data model

9 Firestore collections (plus `_counters` for numeric id generation):

- `stations`, `tracks` — infrastructure master data
- `faults`, `maintenance_tasks`, `notifications`, `users` — fault domain
- `devices`, `sensor_readings`, `alert_logs` — hardware/telemetry domain

Key behaviors:

- Numeric ids are allocated transactionally from `_counters` documents.
- `tracks.temperature/vibration/displacement` are **cached latest readings**,
  refreshed by the trigger logic in `sensorReadings.service.ts`
  (`applyTrackTrigger`) whenever a new reading is ingested. History stays in
  `sensor_readings`.
- Aggregates (active fault counts, dashboard stats, chart datasets) are computed
  in `dashboard.service.ts`, never stored, so they can't go stale.

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