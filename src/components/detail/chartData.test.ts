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
    expect(toleranceBands(kpiConfig('Temperature (24h)'), 21).green).toEqual([19.5, 22.5])
    expect(toleranceBands(kpiConfig('Temperature (24h)'), 21).amber).toEqual([18, 24])
  })

  it('higher is better: amber strip below the green strip, which stops at the budget, nothing above', () => {
    const { green, amber } = toleranceBands(kpiConfig('Harvest'), 100) // green 3 %, amber 8 %
    expect(green).toEqual([97, 100])
    expect(amber).toEqual([92, 97])
  })

  it('lower is better: green strip from the budget up, then the amber strip, nothing below', () => {
    const heating = toleranceBands(kpiConfig('Heating energy (approx.)'), 100) // green 10 %, amber 25 %
    expect(heating.green).toEqual([100, 110])
    expect(heating.amber).toEqual([110, 125])
    const waste = toleranceBands(kpiConfig('Waste'), 4) // green 0.5, amber 1.5 percentage points
    expect(waste.green).toEqual([4, 4.5])
    expect(waste.amber).toEqual([4.5, 5.5])
  })

  it('one-sided bands meet without overlapping and have finite edges', () => {
    for (const [kpi, target] of [['Harvest', 1.25], ['Cumulative harvest', 7.4], ['Waste', 2], ['LED lighting', 12]] as const) {
      const { green, amber } = toleranceBands(kpiConfig(kpi), target)
      expect([...green, ...amber].every(Number.isFinite), kpi).toBe(true)
      const direction = kpiConfig(kpi).direction
      if (direction === 'higher') {
        expect(amber[1], kpi).toBeCloseTo(green[0])
        expect(green[1], kpi).toBe(target)
      } else {
        expect(green[0], kpi).toBe(target)
        expect(green[1], kpi).toBeCloseTo(amber[0])
      }
    }
  })

  it('scales with the size of a negative or zero target', () => {
    expect(toleranceBands(kpiConfig('Harvest'), -100).green).toEqual([-103, -100])
    expect(toleranceBands(kpiConfig('LED lighting'), 0).green).toEqual([0, 0])
  })
})

describe('chart model', () => {
  it('keeps gaps as null and stops a higher-is-better band at the budget', () => {
    const model = buildChartModel(kpiConfig('Harvest'), weeks, [point(weeks[0]!.id, null, 10), point(weeks[1]!.id, 9, 10)])
    expect(model.rows[0]!.actual).toBeNull()
    expect(model.rows[1]!.actual).toBe(9)
    const [lo, hi] = model.domain
    expect(model.rows[1]!.green![1]).toBe(10) // the budget, not the top of the plot
    expect(model.rows[1]!.green![0]).toBeCloseTo(9.7)
    expect(model.rows[1]!.amber![0]).toBeCloseTo(9.2)
    expect(model.rows[1]!.amber![1]).toBeCloseTo(9.7)
    expect(lo).toBeLessThan(9.2)
    expect(hi).toBeGreaterThanOrEqual(10)
    expect(model.hasActual && model.hasTarget).toBe(true)
  })

  it('keeps the plot inside the data and the bands: no band reaches past the domain', () => {
    const model = buildChartModel(kpiConfig('Waste'), weeks, [point(weeks[0]!.id, 1.2, 1), point(weeks[1]!.id, 1.4, 1)])
    for (const row of model.rows) {
      for (const band of [row.green!, row.amber!]) {
        expect(band[0]).toBeGreaterThanOrEqual(model.domain[0])
        expect(band[1]).toBeLessThanOrEqual(model.domain[1])
      }
    }
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
