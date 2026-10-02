// Turns a KPI's 13 weekly points into the rows a line chart needs, including the tolerance bands.

import type { KpiConfig } from '../../config/kpis'
import { shortWeek } from '../../data/dates'
import type { WeekInfo } from '../../data/types'
import type { FlagMark, WeeklyPoint } from '../../scoring/effective'

export type Band = [low: number, high: number]

export interface ChartRow {
  week: string
  label: string
  actual: number | null
  target: number | null
  /** Green zone around the target. */
  green: Band | null
  /** Amber zone (includes the green one; drawn underneath it). */
  amber: Band | null
  /** Set (to the top of the plot) when this week holds a flagged value, to draw the flag marker. */
  flagY: number | null
  actualMark: FlagMark
  targetMark: FlagMark
  openFlags: number
  decidedFlags: number
}

export interface ChartModel {
  rows: ChartRow[]
  domain: [number, number]
  /** Round-number tick positions for the value axis, first and last being the domain edges. */
  ticks: number[]
  hasActual: boolean
  hasTarget: boolean
}

/** The green and amber zones around one target value, for this KPI's direction and variance mode. Infinite sides mean "no limit". */
export function toleranceBands(config: KpiConfig, target: number): { green: Band; amber: Band } {
  const size = (tolerance: number) => (config.variance === 'percent' ? (Math.abs(target) * tolerance) / 100 : tolerance)
  const zone = (tolerance: number): Band => {
    const t = size(tolerance)
    switch (config.direction) {
      case 'higher':
        return [target - t, Infinity]
      case 'lower':
        return [-Infinity, target + t]
      case 'target':
        return [target - t, target + t]
    }
  }
  return { green: zone(config.green), amber: zone(config.amber) }
}

/** Round-number axis: ticks at a 1, 2, 2.5 or 5 times a power of ten that cover [lo, hi]. */
export function niceScale(lo: number, hi: number, wanted = 4): number[] {
  const span = hi - lo || Math.abs(hi) || 1
  const rough = span / (wanted - 1)
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= rough * 0.85) ?? 10 * power)
  const first = Math.floor(lo / step + 1e-9) * step
  const ticks: number[] = []
  for (let v = first; v < hi + step * 0.999; v += step) ticks.push(Number(v.toPrecision(12)))
  return ticks.length >= 2 ? ticks : [first, first + step]
}

export function buildChartModel(config: KpiConfig, weeks: WeekInfo[], points: (WeeklyPoint | undefined)[]): ChartModel {
  const raw = weeks.map((w, i) => {
    const p = points[i]
    const bands = p?.target != null ? toleranceBands(config, p.target) : null
    return { w, p, bands }
  })

  const finite: number[] = []
  for (const { p, bands } of raw) {
    if (p?.actual != null) finite.push(p.actual)
    if (p?.target != null) finite.push(p.target)
    if (bands) for (const v of [...bands.green, ...bands.amber]) if (Number.isFinite(v)) finite.push(v)
  }
  const lo = finite.length ? Math.min(...finite) : 0
  const hi = finite.length ? Math.max(...finite) : 1
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1
  const ticks = niceScale(lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad)
  const domainLo = ticks[0]!
  const domainHi = ticks[ticks.length - 1]!
  const clip = (band: Band): Band => [Number.isFinite(band[0]) ? band[0] : domainLo, Number.isFinite(band[1]) ? band[1] : domainHi]

  const rows = raw.map(({ w, p, bands }): ChartRow => {
    const flagged = (p?.openFlags ?? 0) + (p?.decidedFlags ?? 0) > 0
    return {
      week: w.id,
      label: shortWeek(w.id),
      actual: p?.actual ?? null,
      target: p?.target ?? null,
      green: bands ? clip(bands.green) : null,
      amber: bands ? clip(bands.amber) : null,
      flagY: flagged ? domainHi : null,
      actualMark: p?.actualMark ?? null,
      targetMark: p?.targetMark ?? null,
      openFlags: p?.openFlags ?? 0,
      decidedFlags: p?.decidedFlags ?? 0,
    }
  })
  return {
    rows,
    domain: [domainLo, domainHi],
    ticks,
    hasActual: rows.some((r) => r.actual !== null),
    hasTarget: rows.some((r) => r.target !== null),
  }
}
