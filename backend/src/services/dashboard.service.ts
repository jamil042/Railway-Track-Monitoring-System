import { db } from '../db/index.js'
import type { DashboardStats } from '../types/index.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function getStats(stationId?: string | null): DashboardStats {
  if (stationId) {
    // Station-scoped stats: sudhu ei station-er tracks/faults count hoy.
    return db
      .prepare(
        `SELECT
            1 AS totalStations,
            (SELECT COUNT(*) FROM tracks WHERE station_id = @st) AS totalTracks,
            (SELECT COUNT(*) FROM tracks WHERE station_id = @st AND status IN ('warning','critical')) AS activeFaults,
            (SELECT COUNT(*) FROM tracks WHERE station_id = @st AND status = 'critical') AS criticalFaults,
            (SELECT COUNT(*) FROM faults WHERE station_id = @st AND status = 'fixed' AND date(detection_time) = date('now')) AS fixedToday,
            (SELECT COUNT(*) FROM maintenance_tasks m JOIN tracks t ON t.id = m.track_id
              WHERE t.station_id = @st AND m.status IN ('pending','in_progress')) AS underMaintenance,
            CASE
              WHEN (SELECT COUNT(*) FROM tracks WHERE station_id = @st AND status = 'critical') > 0 THEN 'critical'
              WHEN (SELECT COUNT(*) FROM tracks WHERE station_id = @st AND status = 'warning') > 0 THEN 'degraded'
              ELSE 'operational'
            END AS systemStatus`,
      )
      .get({ st: stationId }) as DashboardStats
  }
  return db
    .prepare(
      `SELECT total_stations AS totalStations,
              total_tracks AS totalTracks,
              active_faults AS activeFaults,
              critical_faults AS criticalFaults,
              fixed_today AS fixedToday,
              under_maintenance AS underMaintenance,
              system_status AS systemStatus
       FROM v_dashboard_stats`,
    )
    .get() as DashboardStats
}

export function getFaultTrend(stationId?: string | null): { date: string; faults: number; fixed: number }[] {
  const rows = (
    stationId
      ? db.prepare(
          `SELECT date(detection_time) AS date, COUNT(*) AS faults,
                  SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) AS fixed
             FROM faults WHERE station_id = ?
            GROUP BY date(detection_time) ORDER BY date(detection_time)`,
        ).all(stationId)
      : db.prepare('SELECT * FROM v_fault_trend').all()
  ) as { date: string; faults: number; fixed: number }[]
  return rows.map((r) => {
    const [year, month, day] = r.date.split('-').map(Number)
    return { date: `${MONTHS[(month ?? 1) - 1]} ${day}`, faults: Number(r.faults), fixed: Number(r.fixed) }
  })
}

export function getFaultByType(stationId?: string | null): { name: string; value: number }[] {
  const rows = (
    stationId
      ? db.prepare('SELECT fault_type AS name, COUNT(*) AS value FROM faults WHERE station_id = ? GROUP BY fault_type ORDER BY value DESC').all(stationId)
      : db.prepare('SELECT * FROM v_fault_by_type').all()
  ) as { name: string; value: number }[]
  return rows.map((r) => ({
    name: r.name,
    value: Number(r.value),
  }))
}

export function getMonthlyStats(stationId?: string | null): { month: string; faults: number; fixed: number; maintenance: number }[] {
  const rows = (
    stationId
      ? db.prepare(
          `SELECT strftime('%Y-%m', f.detection_time) AS month, COUNT(DISTINCT f.id) AS faults,
                  SUM(CASE WHEN f.status = 'fixed' THEN 1 ELSE 0 END) AS fixed,
                  COUNT(DISTINCT m.id) AS maintenance
             FROM faults f LEFT JOIN maintenance_tasks m ON m.fault_id = f.id
            WHERE f.station_id = ?
            GROUP BY strftime('%Y-%m', f.detection_time) ORDER BY month`,
        ).all(stationId)
      : db.prepare('SELECT * FROM v_monthly_stats').all()
  ) as {
    month: string
    faults: number
    fixed: number
    maintenance: number
  }[]
  return rows.map((r) => {
    const monthIndex = Number(r.month.split('-')[1]) - 1
    return { month: MONTHS[monthIndex] ?? r.month, faults: Number(r.faults), fixed: Number(r.fixed), maintenance: Number(r.maintenance) }
  })
}

export function getFaultByStation(stationId?: string | null): { name: string; faults: number }[] {
  if (stationId) {
    return (db.prepare('SELECT name FROM stations WHERE id = ?').all(stationId) as { name: string }[])
      .map((s) => ({ name: s.name, faults: 0 }))
  }
  return (db.prepare('SELECT * FROM v_fault_by_station').all() as { name: string; faults: number }[]).map((r) => ({
    name: r.name,
    faults: Number(r.faults),
  }))
}