/**
 * Demo mode: ek matro ekta hardware device ase, tai "active station" concept —
 * shob shesh je station e login korse, ei device er detection oi station er
 * fault/alert hoye jabe. Real deployment e prottek station er nijer device
 * thakle eta lagbe na.
 */

let activeStationId = 'ST01'

export function setActiveStation(stationId: string): void {
  activeStationId = stationId
}

export function getActiveStation(): string {
  return activeStationId
}

/** Station er prothonom live track (ST03 -> TR-011). */
export function firstTrackOfStation(stationId: string): string {
  const n = parseInt(stationId.replace('ST', ''), 10) || 1
  const seq = (n - 1) * 5 + 1
  return `TR-${String(seq).padStart(3, '0')}`
}
