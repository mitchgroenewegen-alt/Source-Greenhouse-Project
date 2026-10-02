import { describe, expect, it } from 'vitest'
import { loadTestData } from '../src/test/loadData'
import { aggregate, rollup } from '../src/data/aggregate'
import { cropWeekOn, excelSerialToIso, isoWeekOf } from '../src/data/dates'

const data = loadTestData()

describe('prepare-data: shape of the data file', () => {
  it('has 8 cultivations, 36 KPIs, 91 days and 13 weeks (W22 to W34)', () => {
    expect(data.cultivations).toHaveLength(8)
    expect(data.kpis).toHaveLength(36)
    expect(new Set(data.daily.map((r) => r.date)).size).toBe(91)
    expect(data.weeks).toHaveLength(13)
    expect(data.weeks[0]!.id).toBe('2025-W22')
    expect(data.weeks.at(-1)!.id).toBe('2025-W34')
    expect(data.meta.periodStart).toBe('2025-05-26')
    expect(data.meta.periodEnd).toBe('2025-08-24')
  })

  it('gives W34 as Monday 18 Aug to Sunday 24 Aug 2025', () => {
    const w34 = data.weeks.find((w) => w.id === '2025-W34')!
    expect([w34.start, w34.end]).toEqual(['2025-08-18', '2025-08-24'])
  })

  it('reads PA-P1-TOV cumulative harvest on 2025-08-24 as 84.44 actual vs 79.91 target', () => {
    const row = data.daily.find(
      (r) => r.cultivation === 'PA-P1-TOV' && r.kpi === 'Cumulative harvest' && r.date === '2025-08-24',
    )
    expect(row?.actual).toBe(84.44)
    expect(row?.target).toBe(79.91)
  })

  it('keeps empty cells as null, never zero', () => {
    const empties = data.daily.filter((r) => r.actual === null || r.target === null)
    expect(empties.length).toBeGreaterThan(0)
    expect(data.daily.every((r) => r.actual === null || typeof r.actual === 'number')).toBe(true)
  })

  it('reads the dictionary aggregation rules, with Waste as last value of the week', () => {
    const rule = (name: string) => data.kpis.find((k) => k.name === name)?.aggregation
    expect(rule('Harvest')).toBe('sum')
    expect(rule('Cumulative harvest')).toBe('last')
    expect(rule('Waste')).toBe('last')
    expect(rule('Temperature (24h)')).toBe('average')
  })

  it('reads planting dates and areas from the Greenhouses sheet', () => {
    const pa1 = data.cultivations.find((c) => c.id === 'PA-P1-TOV')!
    expect(pa1.plantingDate).toBe('2024-10-14')
    expect(pa1.areaM2).toBe(98400)
    expect(pa1.facility).toBe('Pennsylvania')
    expect(cropWeekOn(pa1.plantingDate, data.meta.periodEnd)).toBe(pa1.cropWeekAtEnd)
  })
})

describe('prepare-data: weekly roll-ups', () => {
  const weekly = (c: string, k: string, w: string) =>
    data.weekly.find((r) => r.cultivation === c && r.kpi === k && r.week === w)!

  it('sums harvest over the days that have both actual and target', () => {
    const days = data.daily.filter(
      (r) => r.cultivation === 'PA-P1-TOV' && r.kpi === 'Harvest' && r.week === '2025-W34' && r.actual !== null && r.target !== null,
    )
    const w = weekly('PA-P1-TOV', 'Harvest', '2025-W34')
    expect(w.days).toBe(days.length)
    expect(w.actual).toBeCloseTo(days.reduce((s, r) => s + r.actual!, 0), 6)
    expect(w.target).toBeCloseTo(days.reduce((s, r) => s + r.target!, 0), 6)
  })

  it('takes the last value for cumulative harvest', () => {
    const w = weekly('PA-P1-TOV', 'Cumulative harvest', '2025-W34')
    expect([w.actual, w.target]).toEqual([84.44, 79.91])
  })
})

describe('aggregation helpers', () => {
  it('uses only days that have both values, for actual and target alike', () => {
    const r = rollup(
      [
        { date: '2025-01-01', actual: 1, target: 1 },
        { date: '2025-01-02', actual: 2, target: null }, // no target: left out of both sides
        { date: '2025-01-03', actual: null, target: 4 }, // no actual: left out of both sides
        { date: '2025-01-04', actual: 3, target: 5 },
      ],
      'sum',
    )
    expect(r).toEqual({ actual: 4, target: 6, days: 2, paired: true })
  })

  it('averages and takes last values with the same rule', () => {
    expect(aggregate([1, 2, 6], 'average')).toBe(3)
    expect(aggregate([1, 2, 6], 'last')).toBe(6)
    expect(aggregate([], 'sum')).toBeNull()
  })

  it('does not pair when no day has both', () => {
    const r = rollup([{ date: '2025-01-01', actual: 2, target: null }], 'average')
    expect(r).toEqual({ actual: 2, target: null, days: 1, paired: false })
  })
})

describe('date helpers (UTC, no timezone shift)', () => {
  it('converts Excel serials to the right calendar day', () => {
    expect(excelSerialToIso(45803)).toBe('2025-05-26')
    expect(excelSerialToIso(45893)).toBe('2025-08-24')
    expect(excelSerialToIso(45579)).toBe('2024-10-14')
  })

  it('finds ISO weeks, including year boundaries', () => {
    expect(isoWeekOf('2025-05-26')).toBe('2025-W22')
    expect(isoWeekOf('2025-08-24')).toBe('2025-W34')
    expect(isoWeekOf('2024-12-30')).toBe('2025-W01')
    expect(isoWeekOf('2021-01-03')).toBe('2020-W53')
  })
})
