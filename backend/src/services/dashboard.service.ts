import { COL, firestore } from '../db/index.js'
import type { DashboardStats } from '../types/index.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Replaces v_dashboard_stats + the station-scoped stats query. */
export async function getStats(stationId?: string | null): Promise<DashboardStats> {
  const tracksSnap = stationId
    ? await firestore.collection(COL.tracks).where('stationId', '==', stationId).get()
    : await firestore.collection(COL.tracks).get()
  const faultsSnap = await firestore.collection(COL.faults).get()
  const tasksSnap = stationId
    ? await firestore.collection(COL.maintenanceTasks).where('stationId', '==', stationId).get()
    : await firestore.collection(COL.maintenanceTasks).get()

  // A track counts as "live" when it actually has a sensor reading.
  const readings = await firestore.collection(COL.sensorReadings).get()
  const liveTrackIds = new Set(readings.docs.map((d) => d.data().trackId as string | undefined).filter(Boolean))

  let activeFaults = 0
  let criticalFaults = 0
  for (const t of tracksSnap.docs) {
    if (!liveTrackIds.has(t.id)) continue
    if (t.data().status === 'warning') activeFaults++
    if (t.data().status === 'critical') {
      activeFaults++
      criticalFaults++
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const fixedToday = faultsSnap.docs.filter(
    (d) => d.data().status === 'fixed' && d.data().detectionTime?.slice(0, 10) === today,
  ).length
  const underMaintenance = tasksSnap.docs.filter((d) =>
    ['pending', 'in_progress'].includes(d.data().status),
  ).length

  const stationsCount = stationId ? 1 : (await firestore.collection(COL.stations).count().get()).data().count

  return {
    totalStations: stationsCount,
    totalTracks: tracksSnap.size,
    activeFaults,
    criticalFaults,
    fixedToday,
    underMaintenance,
    systemStatus: criticalFaults > 0 ? 'critical' : activeFaults > 0 ? 'degraded' : 'operational',
  }
}

function dayOf(iso?: string): string {
  return iso?.slice(0, 10) ?? ''
}

export async function getFaultTrend(stationId?: string | null): Promise<{ date: string; faults: number; fixed: number }[]> {
  let q = firestore.collection(COL.faults) as FirebaseFirestore.Query
  if (stationId) q = q.where('stationId', '==', stationId)
  const snap = await q.get()

  const byDay = new Map<string, { faults: number; fixed: number }>()
  for (const d of snap.docs) {
    const day = dayOf(d.data().detectionTime)
    if (!day) continue
    const agg = byDay.get(day) ?? { faults: 0, fixed: 0 }
    agg.faults++
    if (d.data().status === 'fixed') agg.fixed++
    byDay.set(day, agg)
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, agg]) => {
      const [, month, dNum] = day.split('-').map(Number)
      return { date: `${MONTHS[(month ?? 1) - 1]} ${dNum}`, ...agg }
    })
}

export async function getFaultByType(stationId?: string | null): Promise<{ name: string; value: number }[]> {
  let q = firestore.collection(COL.faults) as FirebaseFirestore.Query
  if (stationId) q = q.where('stationId', '==', stationId)
  const snap = await q.get()

  const byType = new Map<string, number>()
  for (const d of snap.docs) {
    const name = d.data().faultType || 'unknown'
    byType.set(name, (byType.get(name) ?? 0) + 1)
  }
  return [...byType.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export async function getMonthlyStats(
  stationId?: string | null,
): Promise<{ month: string; faults: number; fixed: number; maintenance: number }[]> {
  let q = firestore.collection(COL.faults) as FirebaseFirestore.Query
  if (stationId) q = q.where('stationId', '==', stationId)

  const [faultsSnap, tasksSnap] = await Promise.all([q.get(), firestore.collection(COL.maintenanceTasks).get()])
  const tasksByFault = new Set(tasksSnap.docs.map((d) => d.data().faultId))

  const byMonth = new Map<string, { faults: number; fixed: number; maintenance: number }>()
  for (const d of faultsSnap.docs) {
    const f = d.data()
    const month = dayOf(f.detectionTime).slice(0, 7)
    if (!month) continue
    const agg = byMonth.get(month) ?? { faults: 0, fixed: 0, maintenance: 0 }
    agg.faults++
    if (f.status === 'fixed') agg.fixed++
    if (tasksByFault.has(d.id)) agg.maintenance++
    byMonth.set(month, agg)
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, agg]) => ({
      month: MONTHS[Number(month.split('-')[1]) - 1] ?? month,
      ...agg,
    }))
}

export async function getFaultByStation(stationId?: string | null): Promise<{ name: string; faults: number }[]> {
  if (stationId) {
    const snap = await firestore.collection(COL.stations).doc(stationId).get()
    return snap.exists ? [{ name: snap.data()?.name, faults: 0 }] : []
  }

  const [stationsSnap, faultsSnap] = await Promise.all([
    firestore.collection(COL.stations).orderBy('name').get(),
    firestore.collection(COL.faults).get(),
  ])
  const countByStation = new Map<string, number>()
  for (const d of faultsSnap.docs) {
    const sid = d.data().stationId
    countByStation.set(sid, (countByStation.get(sid) ?? 0) + 1)
  }
  return stationsSnap.docs.map((d) => ({ name: d.data().name, faults: countByStation.get(d.id) ?? 0 }))
}
