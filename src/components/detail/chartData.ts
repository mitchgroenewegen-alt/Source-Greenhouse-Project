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
  /** Green zone. Around the budget for close-to-target KPIs; between the green limit and the budget for one-sided KPIs. */
  green: Band | null
  /**
   * Amber zone. Close-to-target KPIs: the whole +/- amber range (drawn underneath the green zone).
   * One-sided KPIs: only the strip between the amber limit and the green limit, nothing beyond.
   */
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

/**
 * The green and amber zones for one target value, for this KPI's direction and variance mode.
 *   close to target : green is target +/- green; amber is target +/- amber, so it contains the green zone (draw it first).
 *   higher is better: amber is [target - amber, target - green]; green is [target - green, target]. Nothing above the target,
 *                     because beating the budget is not something to shade.
 *   lower is better : green is [target, target + green]; amber is [target + green, target + amber]. Nothing below the target.
 * Every band has finite edges. The two bands of a one-sided KPI meet but do not overlap.
 */
export function toleranceBands(config: KpiConfig, target: number): { green: Band; amber: Band } {
  const size = (tolerance: number) => (config.variance === 'percent' ? (Math.abs(target) * tolerance) / 100 : tolerance)
  const g = size(config.green)
  const a = size(config.amber)
  switch (config.direction) {
    case 'higher':
      return { green: [target - g, target], amber: [target - a, target - g] }
    case 'lower':
      return { green: [target, target + g], amber: [target + g, target + a] }
    case 'target':
      return { green: [target - g, target + g], amber: [target - a, target + a] }
  }
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
    if (bands) for (const v of [...bands.green, ...bands.amber]) finite.push(v)
  }
  const lo = finite.length ? Math.min(...finite) : 0
  const hi = finite.length ? Math.max(...finite) : 1
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1
  const ticks = niceScale(lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad)
  const domainLo = ticks[0]!
  const domainHi = ticks[ticks.length - 1]!

  const rows = raw.map(({ w, p, bands }): ChartRow => {
    const flagged = (p?.openFlags ?? 0) + (p?.decidedFlags ?? 0) > 0
    return {
      week: w.id,
      label: shortWeek(w.id),
      actual: p?.actual ?? null,
      target: p?.target ?? null,
      green: bands ? bands.green : null,
      amber: bands ? bands.amber : null,
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
