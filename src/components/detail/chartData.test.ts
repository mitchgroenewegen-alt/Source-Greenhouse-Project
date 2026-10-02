import { describe, expect, it } from 'vitest'
import { kpiConfig } from '../../config/kpis'
import type { WeekInfo } from '../../data/types'
import type { WeeklyPoint } from '../../scoring/effective'
import { buildChartModel, niceScale, toleranceBands } from './chartData'

const weeks: WeekInfo[] = [
  { id: '2025-W33', start: '2025-08-11', end: '2025-08-17' },
  { id: '2025-W34', start: '2025-08-18', end: '2025-08-24' },
]
const point = (week: string, actual: number | null, target: number | null, extra: Partial<WeeklyPoint> = {}): WeeklyPoint => ({
  week,
  cultivation: 'X',
  kpi: 'K',
  actual,
  target,
  days: 7,
  paired: actual !== null && target !== null,
  openFlags: 0,
  decidedFlags: 0,
  actualMark: null,
  targetMark: null,
  ...extra,
})

describe('tolerance bands', () => {
  it('close to target: target +/- the tolerance, in percent or in units', () => {
    expect(toleranceBands(kpiConfig('Fruit weight'), 100).green).toEqual([95, 105])
    expect(toleranceBands(kpiConfig('Fruit weight'), 100).amber).toEqual([90, 110])
    expect(toleranceBands(kpiConfig('Temperature (24h)'), 21).green).toEqual([20, 22])
    expect(toleranceBands(kpiConfig('Temperature (24h)'), 21).amber).toEqual([19, 23])
  })

  it('higher is better: open at the top; lower is better: open at the bottom', () => {
    expect(toleranceBands(kpiConfig('Harvest'), 100).green).toEqual([97, Infinity])
    expect(toleranceBands(kpiConfig('Harvest'), 100).amber).toEqual([92, Infinity])
    expect(toleranceBands(kpiConfig('Waste'), 4).green[1]).toBeCloseTo(4.2)
    expect(toleranceBands(kpiConfig('Waste'), 4).green[0]).toBe(-Infinity)
  })
})

describe('chart model', () => {
  it('keeps gaps as null and closes open bands at the edge of the plot', () => {
    const model = buildChartModel(kpiConfig('Harvest'), weeks, [point(weeks[0]!.id, null, 10), point(weeks[1]!.id, 9, 10)])
    expect(model.rows[0]!.actual).toBeNull()
    expect(model.rows[1]!.actual).toBe(9)
    const [lo, hi] = model.domain
    expect(model.rows[1]!.green![1]).toBe(hi)
    expect(model.rows[1]!.green![0]).toBeCloseTo(9.7)
    expect(lo).toBeLessThan(9)
    expect(model.hasActual && model.hasTarget).toBe(true)
  })

  it('marks weeks with flagged values at the top of the plot', () => {
    const model = buildChartModel(kpiConfig('Fruit weight'), weeks, [point(weeks[0]!.id, 40, 40, { openFlags: 2, targetMark: 'open' }), point(weeks[1]!.id, 41, 40)])
    expect(model.rows[0]!.flagY).toBe(model.domain[1])
    expect(model.rows[1]!.flagY).toBeNull()
    expect(model.rows[0]!.targetMark).toBe('open')
  })

  it('copes with a KPI that has no data or no target', () => {
    const empty = buildChartModel(kpiConfig('Solar radiation'), weeks, [undefined, undefined])
    expect(empty.hasActual || empty.hasTarget).toBe(false)
    const noTarget = buildChartModel(kpiConfig('Solar radiation'), weeks, [point(weeks[0]!.id, 2000, null), point(weeks[1]!.id, 2100, null)])
    expect(noTarget.hasActual).toBe(true)
    expect(noTarget.hasTarget).toBe(false)
    expect(noTarget.rows[0]!.green).toBeNull()
  })
})

describe('nice axis', () => {
  it('picks round ticks that cover the range', () => {
    expect(niceScale(0, 3.41)).toEqual([0, 1, 2, 3, 4])
    expect(niceScale(126.3, 203.2)).toEqual([125, 150, 175, 200, 225])
    expect(niceScale(0, 1.25)).toEqual([0, 0.5, 1, 1.5])
  })

  it('handles a flat series', () => {
    const ticks = niceScale(5, 5)
    expect(ticks[0]).toBeLessThanOrEqual(5)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(5)
  })
})
