-- ============================================================================
-- Smart Railway Track Monitoring and Early Warning System
-- SQLite Schema (v1.0)
--
-- Usage:
--   sqlite3 railway.db < schema.sql
--
-- NOTE: SQLite enforces foreign keys per-connection, NOT by default. Every
-- connection that opens this database MUST run:
--     PRAGMA foreign_keys = ON;
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- Reference / master data
-- ----------------------------------------------------------------------------

CREATE TABLE stations (
    id            TEXT PRIMARY KEY,                        -- 'st1', 'st2', ...
    name          TEXT NOT NULL UNIQUE,
    location      TEXT NOT NULL,
    total_tracks  INTEGER NOT NULL DEFAULT 0 CHECK (total_tracks >= 0),
    status        TEXT NOT NULL DEFAULT 'safe'
                  CHECK (status IN ('safe', 'warning', 'critical'))
);

CREATE TABLE tracks (
    id                  TEXT PRIMARY KEY,                  -- 'TR-001', ...
    station_id          TEXT NOT NULL
                        REFERENCES stations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    status              TEXT NOT NULL DEFAULT 'safe'
                        CHECK (status IN ('safe', 'warning', 'critical')),
    sensor_health       INTEGER NOT NULL DEFAULT 100
                        CHECK (sensor_health BETWEEN 0 AND 100),
    image_url           TEXT,
    -- Latest cached sensor snapshot, denormalized for the dashboard.
    -- Authoritative history lives in sensor_readings and is kept in sync by
    -- the trg_track_latest_reading trigger.
    temperature         REAL,                              -- latest cached °C
    vibration           REAL,                              -- latest cached count/500ms
    displacement        REAL,                              -- latest cached cm (ultrasonic)
    baseline_distance   REAL NOT NULL DEFAULT 20,          -- normal idle ultrasonic distance (cm)
    baseline_vibration  REAL NOT NULL DEFAULT 0,           -- normal idle vibration count
    readings_updated_at TEXT                               -- ISO-8601 of cached snapshot
);

CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,                           -- store hashes, never plaintext
    name          TEXT NOT NULL,
    role          TEXT NOT NULL
                  CHECK (role IN ('station_incharge', 'maintenance_team', 'railway_administrator')),
    email         TEXT,
    avatar        TEXT,
    station_id    TEXT
                  REFERENCES stations(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- Fault domain
-- ----------------------------------------------------------------------------

CREATE TABLE faults (
    id              TEXT PRIMARY KEY,                      -- 'FLT-2026-001', ...
    station_id      TEXT NOT NULL
                    REFERENCES stations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    track_id        TEXT
                    REFERENCES tracks(id) ON DELETE SET NULL ON UPDATE CASCADE,
    fault_type      TEXT NOT NULL,
    severity        TEXT NOT NULL
                    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    detection_time  TEXT NOT NULL,                         -- ISO-8601
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'under_maintenance', 'fixed')),
    image_url       TEXT,
    ai_confidence   REAL NOT NULL DEFAULT 0
                    CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    sensor_values   TEXT,                                  -- JSON snapshot: {temperature, vibration, displacement, pressure}
    remarks         TEXT,
    description     TEXT
);

CREATE TABLE maintenance_tasks (
    id              TEXT PRIMARY KEY,                      -- 'MNT-001', ...
    fault_id        TEXT NOT NULL
                    REFERENCES faults(id) ON DELETE CASCADE ON UPDATE CASCADE,
    track_id        TEXT
                    REFERENCES tracks(id) ON DELETE SET NULL ON UPDATE CASCADE,
    assigned_team   TEXT NOT NULL,
    engineer        TEXT NOT NULL,
    progress        INTEGER NOT NULL DEFAULT 0
                    CHECK (progress BETWEEN 0 AND 100),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed')),
    start_time      TEXT,                                  -- ISO-8601
    completion_time TEXT                                   -- ISO-8601
);

CREATE TABLE notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER                                   -- NULL = broadcast to all
                REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    type        TEXT NOT NULL
                CHECK (type IN ('critical', 'warning', 'info', 'success')),
    time        TEXT NOT NULL,                             -- ISO-8601
    read        INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1))
);

-- ----------------------------------------------------------------------------
-- Hardware / telemetry (proposal: ESP32 sensor node, Pi vision, LoRa links)
-- ----------------------------------------------------------------------------

CREATE TABLE devices (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id       TEXT NOT NULL
                     REFERENCES stations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    track_id         TEXT
                     REFERENCES tracks(id) ON DELETE SET NULL ON UPDATE CASCADE,
    device_type      TEXT NOT NULL
                     CHECK (device_type IN (
                         'esp32_sensor_node',
                         'raspberry_pi_vision',
                         'lora_transmitter',
                         'lora_receiver_station',
                         'train_unit'
                     )),
    name             TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'online'
                     CHECK (status IN ('online', 'offline', 'degraded', 'maintenance')),
    firmware_version TEXT,
    location         TEXT,
    installed_at     TEXT,                                 -- ISO-8601
    last_heartbeat   TEXT                                  -- ISO-8601
);

CREATE TABLE sensor_readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   INTEGER NOT NULL
                REFERENCES devices(id) ON DELETE CASCADE ON UPDATE CASCADE,
    track_id    TEXT
                REFERENCES tracks(id) ON DELETE SET NULL ON UPDATE CASCADE,
    sensor_type TEXT NOT NULL
                CHECK (sensor_type IN ('ir_beam', 'ultrasonic', 'vibration', 'temperature', 'camera')),
    value       REAL NOT NULL,
    unit        TEXT,
    recorded_at TEXT NOT NULL                              -- ISO-8601
);

CREATE TABLE alert_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fault_id        TEXT NOT NULL
                    REFERENCES faults(id) ON DELETE CASCADE ON UPDATE CASCADE,
    device_id       INTEGER
                    REFERENCES devices(id) ON DELETE SET NULL ON UPDATE CASCADE,
    destination     TEXT NOT NULL
                    CHECK (destination IN ('station_display', 'train_unit')),
    channel         TEXT NOT NULL DEFAULT 'lora',
    message         TEXT NOT NULL,
    severity        TEXT NOT NULL
                    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    sent_at         TEXT NOT NULL,                         -- ISO-8601
    acknowledged_at TEXT,                                  -- ISO-8601
    acknowledged_by INTEGER
                    REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

CREATE INDEX idx_faults_detection_time ON faults (detection_time);
CREATE INDEX idx_faults_status        ON faults (status);
CREATE INDEX idx_faults_station       ON faults (station_id);

CREATE INDEX idx_sensor_readings_device ON sensor_readings (device_id, recorded_at DESC);
CREATE INDEX idx_sensor_readings_track  ON sensor_readings (track_id, recorded_at DESC);

CREATE INDEX idx_alert_logs_sent_at ON alert_logs (sent_at);
CREATE INDEX idx_notifications_user ON notifications (user_id, read);

-- ----------------------------------------------------------------------------
-- Trigger: keep tracks' cached latest readings in sync with the telemetry stream,
-- and derive sensor_health + status from the latest live readings.
--
-- Status is computed as DEVATION from each track's own baseline (the idle,
-- healthy reading), not from hardcoded absolute values. So a sensor that sits
-- at ~158cm when empty gets its own 158cm baseline; a deviation (obstacle,
-- heavy vibration) then moves the status.
--
-- Thresholds:
--   vibration deviation  (count/500ms): >= VIB_WARN(3) warning, >= VIB_CRIT(8) critical
--   ultrasonic deviation (cm):          >= US_WARN(3)  warning, >= US_CRIT(6)  critical
-- ----------------------------------------------------------------------------

CREATE TRIGGER trg_track_latest_reading
AFTER INSERT ON sensor_readings
FOR EACH ROW
WHEN NEW.track_id IS NOT NULL AND NEW.sensor_type IN ('temperature', 'vibration', 'ultrasonic')
BEGIN
    UPDATE tracks
       SET temperature      = CASE WHEN NEW.sensor_type = 'temperature' THEN NEW.value ELSE temperature END,
           vibration        = CASE WHEN NEW.sensor_type = 'vibration'   THEN NEW.value ELSE vibration END,
           displacement     = CASE WHEN NEW.sensor_type = 'ultrasonic'  THEN NEW.value ELSE displacement END,
           readings_updated_at = NEW.recorded_at
     WHERE id = NEW.track_id;

    -- Recompute health + status from the (now updated) cached live values,
    -- comparing to each track's own baseline. Health starts at 100 and
    -- loses points for each threshold crossed.
    UPDATE tracks
       SET sensor_health = CAST(MAX(
                 100
                - (CASE WHEN ABS(vibration - baseline_vibration) >=  3 THEN 30 ELSE 0 END)
                - (CASE WHEN ABS(vibration - baseline_vibration) >=  8 THEN 30 ELSE 0 END)
                - (CASE WHEN ABS(displacement - baseline_distance) >=  3 THEN 20 ELSE 0 END)
                - (CASE WHEN ABS(displacement - baseline_distance) >=  6 THEN 20 ELSE 0 END),
                0) AS INTEGER),
           status = CASE
                        WHEN ABS(vibration - baseline_vibration) >= 8
                          OR ABS(displacement - baseline_distance) >= 6 THEN 'critical'
                        WHEN ABS(vibration - baseline_vibration) >= 3
                          OR ABS(displacement - baseline_distance) >= 3 THEN 'warning'
                        ELSE 'safe'
                    END
     WHERE id = NEW.track_id;
END;

-- ----------------------------------------------------------------------------
-- Views: denormalized data consumed by the React frontend
-- ----------------------------------------------------------------------------

-- Tracks joined with station name (frontend Track.stationName)
CREATE VIEW v_track_with_station AS
SELECT t.*, s.name AS station_name
  FROM tracks t
  JOIN stations s ON s.id = t.station_id;

-- Faults with station name (frontend Fault.stationName)
CREATE VIEW v_fault_details AS
SELECT f.*, s.name AS station_name
  FROM faults f
  JOIN stations s ON s.id = f.station_id;

-- Maintenance tasks with fault type + station name (frontend MaintenanceTask)
CREATE VIEW v_maintenance_details AS
SELECT m.*, f.fault_type, s.name AS station_name
  FROM maintenance_tasks m
  JOIN faults f ON f.id = m.fault_id
  JOIN stations s ON s.id = f.station_id;

-- Per-station aggregate (frontend Station.activeFaults)
CREATE VIEW v_station_summary AS
SELECT s.*,
       (SELECT COUNT(*) FROM faults f
         WHERE f.station_id = s.id AND f.status <> 'fixed') AS active_faults
  FROM stations s;

-- Dashboard headline stats (frontend DashboardStats).
-- Fault counts come from LIVE track status, but a track only counts as a
-- "live" track when it actually has a row in sensor_readings (telemetry stream).
-- Seeded-but-idle tracks never touch this table, so they don't inflate numbers.
CREATE VIEW v_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM stations)                          AS total_stations,
    (SELECT COUNT(*) FROM tracks)                            AS total_tracks,
    (SELECT COUNT(*) FROM tracks t
      WHERE EXISTS (SELECT 1 FROM sensor_readings sr WHERE sr.track_id = t.id)
        AND t.status IN ('warning', 'critical'))             AS active_faults,
    (SELECT COUNT(*) FROM tracks t
      WHERE EXISTS (SELECT 1 FROM sensor_readings sr WHERE sr.track_id = t.id)
        AND t.status = 'critical')                           AS critical_faults,
    (SELECT COUNT(*) FROM faults
      WHERE status = 'fixed' AND date(detection_time) = date('now')) AS fixed_today,
    (SELECT COUNT(*) FROM maintenance_tasks
      WHERE status IN ('pending', 'in_progress'))            AS under_maintenance,
    CASE
        WHEN (SELECT COUNT(*) FROM tracks t
               WHERE EXISTS (SELECT 1 FROM sensor_readings sr WHERE sr.track_id = t.id)
                 AND t.status = 'critical') > 0 THEN 'critical'
        WHEN (SELECT COUNT(*) FROM tracks t
               WHERE EXISTS (SELECT 1 FROM sensor_readings sr WHERE sr.track_id = t.id)
                 AND t.status = 'warning') > 0 THEN 'degraded'
        ELSE 'operational'
    END                                                      AS system_status;

-- Chart: daily fault / fixed trend (frontend FAULT_TREND_DATA)
CREATE VIEW v_fault_trend AS
SELECT date(detection_time) AS "date",
       COUNT(*)             AS faults,
       SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) AS fixed
  FROM faults
 GROUP BY date(detection_time)
 ORDER BY date(detection_time);

-- Chart: faults grouped by type (frontend FAULT_TYPE_DATA)
CREATE VIEW v_fault_by_type AS
SELECT fault_type AS name,
       COUNT(*)   AS value
  FROM faults
 GROUP BY fault_type
 ORDER BY value DESC;

-- Chart: monthly aggregates (frontend MONTHLY_STATS)
CREATE VIEW v_monthly_stats AS
SELECT strftime('%Y-%m', f.detection_time) AS month,
       COUNT(DISTINCT f.id)                AS faults,
       SUM(CASE WHEN f.status = 'fixed' THEN 1 ELSE 0 END) AS fixed,
       COUNT(DISTINCT m.id)                AS maintenance
  FROM faults f
  LEFT JOIN maintenance_tasks m ON m.fault_id = f.id
 GROUP BY strftime('%Y-%m', f.detection_time)
 ORDER BY month;

-- Chart: faults per station (frontend STATION_FAULT_DATA)
CREATE VIEW v_fault_by_station AS
SELECT s.name    AS name,
       COUNT(f.id) AS faults
  FROM stations s
  LEFT JOIN faults f ON f.station_id = s.id
 GROUP BY s.id
 ORDER BY faults DESC;