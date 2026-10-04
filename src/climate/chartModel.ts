// Turns the days of one KPI into the rows of a daily line chart, with the same tolerance bands as the weekly charts
// (toleranceBands in src/components/detail/chartData.ts, from the thresholds in src/config/kpis.ts).

import type { KpiConfig } from '../config/kpis'
import { niceScale, toleranceBands, type Band } from '../components/detail/chartData'
import type { DayPoint } from './days'

export interface DailyChartRow extends DayPoint {
  green: Band | null
  amber: Band | null
  amberAbove: Band | null
  /** Set (to the top of the plot) on a day that holds a flagged value, to draw the flag marker; the shared FlagMarker reads it. */
  flagY: number | null
}

export interface DailyChartModel {
  rows: DailyChartRow[]
  domain: [number, number]
  ticks: number[]
  hasActual: boolean
  hasTarget: boolean
  hasFlags: boolean
}

export function dailyChartModel(config: KpiConfig, points: readonly DayPoint[]): DailyChartModel {
  const bands = points.map((p) => (p.target !== null ? toleranceBands(config, p.target) : null))
  const finite: number[] = []
  points.forEach((p, i) => {
    if (p.actual !== null) finite.push(p.actual)
    if (p.target !== null) finite.push(p.target)
    const b = bands[i]
    if (b) finite.push(...b.green, ...b.amber, ...(b.amberAbove ?? []))
  })
  const lo = finite.length ? Math.min(...finite) : 0
  const hi = finite.length ? Math.max(...finite) : 1
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1
  const ticks = niceScale(lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad)
  const domain: [number, number] = [ticks[0]!, ticks[ticks.length - 1]!]
  const rows = points.map((p, i): DailyChartRow => ({
    ...p,
    green: bands[i]?.green ?? null,
    amber: bands[i]?.amber ?? null,
    amberAbove: bands[i]?.amberAbove ?? null,
    flagY: p.openFlags + p.decidedFlags > 0 ? domain[1] : null,
  }))
  return {
    rows,
    domain,
    ticks,
    hasActual: points.some((p) => p.actual !== null),
    hasTarget: points.some((p) => p.target !== null),
    hasFlags: rows.some((r) => r.flagY !== null),
  }
}
