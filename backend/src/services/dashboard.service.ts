import { db } from '../db/index.js'
import type { DashboardStats } from '../types/index.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function getStats(): DashboardStats {
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

export function getFaultTrend(): { date: string; faults: number; fixed: number }[] {
  const rows = db.prepare('SELECT * FROM v_fault_trend').all() as { date: string; faults: number; fixed: number }[]
  return rows.map((r) => {
    const [year, month, day] = r.date.split('-').map(Number)
    return { date: `${MONTHS[(month ?? 1) - 1]} ${day}`, faults: Number(r.faults), fixed: Number(r.fixed) }
  })
}

export function getFaultByType(): { name: string; value: number }[] {
  return (db.prepare('SELECT * FROM v_fault_by_type').all() as { name: string; value: number }[]).map((r) => ({
    name: r.name,
    value: Number(r.value),
  }))
}

export function getMonthlyStats(): { month: string; faults: number; fixed: number; maintenance: number }[] {
  return (
    db.prepare('SELECT * FROM v_monthly_stats').all() as {
      month: string
      faults: number
      fixed: number
      maintenance: number
    }[]
  ).map((r) => {
    const monthIndex = Number(r.month.split('-')[1]) - 1
    return { month: MONTHS[monthIndex] ?? r.month, faults: Number(r.faults), fixed: Number(r.fixed), maintenance: Number(r.maintenance) }
  })
}

export function getFaultByStation(): { name: string; faults: number }[] {
  return (db.prepare('SELECT * FROM v_fault_by_station').all() as { name: string; faults: number }[]).map((r) => ({
    name: r.name,
    faults: Number(r.faults),
  }))
}