# RailGuard — Setup & Change Log

Bangladesh Railway Track Fault Detection System
React + Vite frontend · Express + Firebase Firestore backend · ESP32 sensors · YOLO camera detection

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 22+ | Frontend + backend |
| npm | 10+ | Package manager (lockfile committed) |
| Python | 3.12+ | Camera / sensor pipeline |
| **Git LFS** | latest | Binary files (images, YOLO `.pt` models) are LFS-tracked |

> ⚠️ **Git LFS is mandatory.** `.gitattributes` only *declares* which files are
> LFS-tracked — it does not install anything. Without it, `git pull` gives you
> tiny pointer text files instead of real images/models and the app breaks.

Install Git LFS once, then clone:

```bash
# Debian/Ubuntu
sudo apt install git-lfs
# macOS
brew install git-lfs

git lfs install                     # enables LFS for your user (one time)
git clone <repo-url> && cd railway-track-monitoring
git lfs pull                        # fetches real binary content if you cloned before installing
```

Verify the model downloaded properly (~6.5 MB — a 132-byte file means LFS did not run):

```bash
ls -la hardware/models/railway_yolov8n.pt
```

## Quick Start

```bash
# 1. Frontend dependencies
npm install

# 2. Backend dependencies
cd backend && npm install && cd ..

# 3. Python environment (camera + sensor pipeline)
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt      # or: pip install -r requirements.txt

# 4. Firebase: put your service account key in backend/ and set it in backend/.env
#    FIREBASE_SERVICE_ACCOUNT_PATH=./<your>-firebase-adminsdk-*.json
#    (see "Firebase setup" below)

# 5. Run everything (backend + frontend + camera + sensor fusion + simulator)
./start_system.sh
```

Access:
- **Frontend:** http://<your-ip>:8443
- **Backend API:** http://localhost:5000
- **Camera stream:** http://<your-ip>:8082/stream
- Logs: `tail -f /tmp/<process-name>.log` (backend / frontend / camera_stream / sensor_fusion / track_simulator)

---

## Login Roles

| Role | Credentials | Access |
|---|---|---|
| Railway Administrator | Username: `admin`, Password: `admin123` | Everything — all 12 stations |
| Station Incharge | Station ID: `ST01`–`ST12`, Password: `12345` | Only their own station's data (view faults, live monitoring) |
| Maintenance Team | Station ID: `ST01`–`ST12`, Password: `12345` | Own station only + can update fault status/severity/remarks |

The login page has a role selector — Administrator logs in with username, Incharge/Maintenance log in with Station ID.

### Stations (ST01–ST12)

ST01 Dhaka, ST02 Chattogram, ST03 Tongi, ST04 Akhaura, ST05 Cumilla, ST06 Mymensingh,
ST07 Sylhet, ST08 Rajshahi, ST09 Khulna, ST10 Rangpur, ST11 Dinajpur, ST12 Saidpur.
Each station has 5 tracks. Currently live sensor data exists for ST01 (TR-001, TR-002).

---

## Major Work Completed

### Git & Deployment
- Resolved multi-commit rebase conflicts between `main` and `hardware` branches; both branches now fully synced
- Removed all tracked `.pyc` files; `.gitignore` covers `__pycache__/`, `.venv/`, `Pi-backup/`
- Downloaded the real YOLO model (`railway_yolov8n.pt`, 6.5 MB) that was a broken Git LFS pointer

### start_system.sh Launcher (fixed & extended)
- Wrong directory paths fixed (`frontend` → repo root, `railway` → `hardware`)
- Uses project `.venv` Python automatically when present
- Camera stream moved to port **8082** (8081 was occupied by a system service)
- Now launches 5 processes: backend, frontend, camera_stream, sensor_fusion_dashboard, track_simulator

### Authentication & Authorization
- Role-based login (see table above) — backend issues JWT carrying role + station ID
- Station scoping middleware (`scopedStationId`) applied to every GET endpoint: stations, tracks,
  faults, maintenance, devices, sensor-readings, and all dashboard analytics
- Permission guards:
  - `requireAdmin` — track/station/device/station mutations are admin-only
  - `requireFaultUpdater` — only Maintenance Team and Admin can update fault status;
    Maintenance Team can change only status/severity/remarks fields

### Database (Firebase Firestore)
- The backend uses **Firestore** via `firebase-admin` — SQLite has been fully removed
- Collections: `stations`, `tracks`, `users`, `faults`, `maintenance_tasks`,
  `notifications`, `devices`, `sensor_readings`, `alert_logs`, `_counters`
- Numeric AUTOINCREMENT-style ids are generated through transactional counters in `_counters`
- The old SQLite trigger is ported into `sensorReadings.service.ts` (`applyTrackTrigger`):
  EMA baselines + IR beam rule update cached track values, sensor_health and status on
  every ingest
- SQL views are replaced by denormalized fields: `stationName` on tracks/faults,
  `stationId`/`stationName`/`faultType` on maintenance tasks; dashboard aggregates
  are computed in `dashboard.service.ts`

#### Firebase setup (one time)
1. Create a project at https://console.firebase.google.com and add **Firestore Database**
2. Project Settings → Service accounts → Generate new private key → save the JSON file
   inside `backend/` (do NOT commit it — already gitignored)
3. Add to `backend/.env` (adjust the filename to yours):
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=./<project>-firebase-adminsdk-fbsvc-xxxx.json
   ```
4. Seed initial data (12 stations, 60 tracks, users, devices):
   ```
   cd backend && npm run seed
   ```

### Real-Time Data Pipeline
- `hardware/track_simulator.py` (new): every **1.5 s** posts vibration/ultrasonic/ir_beam
  readings for all 60 tracks to the public ingest endpoint. Per-track base constants
  (derived from track ID) × sinusoidal wave + noise keep values distinct and smooth;
  occasional spikes (~2% vibration ×6–12, ~1% distance drop, ~0.4% IR block) make statuses
  dynamically move between safe → warning → critical and back as the EMA baseline recovers
- Frontend polls DataContext every **1.5 s** — Dashboard, Monitoring, Alerts & Faults,
  Maintenance, Reports all refresh live from the database
- Readings fetch limit raised 100 → 400 to cover 60 tracks × 3 sensors

### Frontend Pages (all database-driven, no dummy data)
- **Monitoring:** shows every track card; admins get a station dropdown filter (All Stations /
  individual); live YOLO camera embedded in each card with an Expand full-screen modal;
  falls back to placeholder image if camera is off
- **Dashboard:** stats cards, fault trend chart, fault type distribution, recent faults —
  station-scoped for non-admins; "Network Uptime" computed from real sensor coverage
- **Alerts & Fault Records:** fault table from DB with search/status filters/pagination
- **Maintenance:** tasks from DB with progress updates saved back
- **Reports & Analytics:** daily/weekly charts computed from real fault records
  (hardcoded dummy arrays removed), monthly from `/api/dashboard/monthly-stats`
- **Settings:** profile updates save to DB via `PUT /api/auth/profile`; password change via
  `PUT /api/auth/password` (bcrypt verified); notification preferences persist in localStorage
- **Login:** role selector, per-role credential fields, no visible demo credentials

### Camera / YOLO
- `camera_stream.py`: Flask MJPEG server (port 8082), sole camera owner, serves
  `/stream` (video) and `/detection` (JSON for sensor_fusion_dashboard)
- Model path made absolute in `yolo_detector.py`; model file committed properly
- Frontend camera URL auto-derived from `window.location.hostname` (`src/camera.ts`,
  overridable via `VITE_CAMERA_STREAM_URL`)

### Backend API Fixes
- Fault update endpoint: Maintenance Team restricted to status/severity/remarks only
- Sensor readings ingest endpoint stays public (ESP32/Pi push telemetry without a session)
- CORS enabled; Firestore is accessed through a single shared Admin SDK client

---

## Troubleshooting

| Problem | Fix |
|---|---|
| YOLO model is a tiny text file / `Failed to load model` | Run `git lfs install && git lfs pull` — see Prerequisites |
| Images broken / show as binary gibberish | Same — LFS files were pulled as pointers |
| Login says "Cannot reach backend" | Start backend: `cd backend && npm run dev` |
| Camera shows placeholder | Check `http://<ip>:8082/stream`; run `./start_system.sh` or start `camera_stream.py` manually |
| `ModuleNotFoundError: cv2` | Use the venv python (launcher does automatically): `.venv/bin/python` |
| Port 8443 busy | `PORT=9000 ./start_system.sh` |
| Statuses never change | Ensure `track_simulator.py` is running (`tail -f /tmp/track_simulator.log`) |
