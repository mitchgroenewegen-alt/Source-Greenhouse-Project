// The finer data: a chosen day of one cultivation, hour by hour, realised against setpoint per parameter.

import type { ClimateReading } from '../workspace/types'

export interface HourPoint {
  /** Hours since midnight, with minutes as a fraction (14:30 is 14.5). */
  hour: number
  value: number
  setpoint: number | null
}

export interface ParameterDay {
  parameter: string
  points: HourPoint[]
  /** Average of (realised - setpoint) over the readings that have a setpoint; null when none has. */
  meanGap: number | null
}

export const hourOf = (timestamp: string): number => Number(timestamp.slice(11, 13)) + Number(timestamp.slice(14, 16)) / 60
export const dayOf = (timestamp: string): string => timestamp.slice(0, 10)

/** The days that have readings for this cultivation, oldest first. */
export function readingDays(readings: readonly ClimateReading[], cultivation: string): string[] {
  return [...new Set(readings.filter((r) => r.cultivation === cultivation).map((r) => dayOf(r.timestamp)))].sort()
}

/** One day, one chart per parameter (alphabetical), points in time order. */
export function daySeries(readings: readonly ClimateReading[], cultivation: string, date: string): ParameterDay[] {
  const byParameter = new Map<string, HourPoint[]>()
  for (const r of readings) {
    if (r.cultivation !== cultivation || dayOf(r.timestamp) !== date) continue
    const list = byParameter.get(r.parameter)
    const point = { hour: hourOf(r.timestamp), value: r.value, setpoint: r.setpoint }
    if (list) list.push(point)
    else byParameter.set(r.parameter, [point])
  }
  return [...byParameter]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([parameter, points]) => {
      points.sort((a, b) => a.hour - b.hour)
      const gaps = points.filter((p) => p.setpoint !== null).map((p) => p.value - p.setpoint!)
      return { parameter, points, meanGap: gaps.length === 0 ? null : gaps.reduce((a, b) => a + b, 0) / gaps.length }
    })
}
