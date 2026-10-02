import { describe, expect, it } from 'vitest'
import { addDays, isoWeekOf } from '../data/dates'
import type { Cultivation, DailyRow } from '../data/types'
import { loadTestData } from '../test/loadData'
import { detectFlags, groupFlags, type Flag } from './index'

const data = loadTestData()
const realFlags = detectFlags(data.daily, data.cultivations)
const realGroups = groupFlags(realFlags, data.daily)

// ---- real data: the cases from the brief ----------------------------------------------------

describe('flags on the real data', () => {
  it('flags PA-P2-TOV Temperature (24h) target 69 from 2025-06-30 to 2025-07-20 and suggests 20.6', () => {
    const cells = realFlags.filter((f) => f.cultivation === 'PA-P2-TOV' && f.kpi === 'Temperature (24h)' && f.field === 'target')
    expect(cells).toHaveLength(21)
    expect(cells.every((f) => f.value === 69 && f.rule === 'unit-fahrenheit' && f.suggestion === 20.6)).toBe(true)
    expect(cells[0]!.date).toBe('2025-06-30')
    expect(cells.at(-1)!.date).toBe('2025-07-20')
    expect(cells[0]!.explanation).toMatch(/Fahrenheit|°F/)
  })

  it('flags AZ-P3-Snack Drain target 0.4 to 0.5 and suggests x100', () => {
    const cells = realFlags.filter((f) => f.cultivation === 'AZ-P3-Snack' && f.kpi === 'Drain' && f.field === 'target')
    expect(cells.length).toBeGreaterThan(80)
    expect(cells.every((f) => f.rule === 'unit-fraction')).toBe(true)
    expect(Math.min(...cells.map((f) => f.value!))).toBe(0.4)
    expect(Math.max(...cells.map((f) => f.value!))).toBe(0.5)
    for (const f of cells) expect(f.suggestion).toBeCloseTo(f.value! * 100, 6)
  })

  it('flags PA-P1-TOV Plant load target 1350 on 2025-06-16', () => {
    const f = realFlags.find((x) => x.id === 'PA-P1-TOV|Plant load|2025-06-16|target')
    expect(f?.value).toBe(1350)
    expect(f?.rule).toBe('unit-factor-10')
    expect(f?.suggestion).toBe(135)
  })

  it('shows each of those as one grouped item', () => {
    const temp = realGroups.filter((g) => g.cultivation === 'PA-P2-TOV' && g.kpi === 'Temperature (24h)')
    expect(temp).toHaveLength(1)
    expect([temp[0]!.startDate, temp[0]!.endDate, temp[0]!.flags.length]).toEqual(['2025-06-30', '2025-07-20', 21])

    const drain = realGroups.filter((g) => g.cultivation === 'AZ-P3-Snack' && g.kpi === 'Drain' && g.rule === 'unit-fraction')
    expect(drain).toHaveLength(1)
    expect(drain[0]!.suggestionNote).toBe('multiply by 100')

    const load = realGroups.find((g) => g.cultivation === 'PA-P1-TOV' && g.kpi === 'Plant load' && g.startDate === '2025-06-16')!
    expect(load.endDate).toBe('2025-06-23') // 1350 and 1400 are in consecutive weeks, so one item
  })

  it('does not flag the ordinary zeros: weekend harvest, or Harvest and Cumulative harvest in young crops', () => {
    const zeroFlags = realFlags.filter(
      (f) => f.value === 0 && ['Harvest', 'Cumulative harvest', 'Heating energy (approx.)', 'LED lighting'].includes(f.kpi),
    )
    expect(zeroFlags).toEqual([])
    const youngZeros = realFlags.filter((f) => f.cultivation.startsWith('ON-') && f.value === 0)
    expect(youngZeros).toEqual([])
  })

  it('does not flag every harvest day that is higher than usual when the cumulative total agrees', () => {
    expect(realFlags.some((f) => f.kpi === 'Harvest' && f.cultivation === 'AZ-P2-Snack' && f.date === '2025-08-17')).toBe(false)
  })

  it('gives every flag a rule, a plain-English explanation and one flag per cell', () => {
    expect(new Set(realFlags.map((f) => f.id)).size).toBe(realFlags.length)
    for (const f of realFlags) {
      expect(f.explanation.length).toBeGreaterThan(20)
      expect(f.rule).toBeTruthy()
    }
  })

  it('keeps the list readable: a few dozen items to review plus the missing values', () => {
    const toReview = realGroups.filter((g) => g.rule !== 'missing-value')
    expect(toReview.length).toBeLessThan(40)
    expect(toReview.length).toBeGreaterThan(10)
  })
})

// ---- synthetic data: one rule at a time ----------------------------------------------------

const MATURE: Cultivation = {
  id: 'T-1',
  facility: 'Test',
  greenhouse: 'Phase 1',
  crop: 'Tomato',
  variety: 'TOV',
  plantingDate: '2024-10-14',
  areaM2: 1000,
  cropWeekAtEnd: 45,
}
const YOUNG: Cultivation = { ...MATURE, id: 'T-2', plantingDate: '2025-05-20' }

/** 28 days from Monday 2025-06-02 (4 whole ISO weeks) with the given actuals and targets. */
function daily(kpi: string, actual: (i: number) => number | null, target: (i: number) => number | null, c = MATURE, days = 28): DailyRow[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays('2025-06-02', i)
    return { date, week: isoWeekOf(date), cultivation: c.id, kpi, actual: actual(i), target: target(i) }
  })
}

const flagsFor = (rows: DailyRow[], c = MATURE): Flag[] => detectFlags(rows, [c])
const only = (flags: Flag[], rule: string) => flags.filter((f) => f.rule === rule)

describe('unit slips', () => {
  it('Fahrenheit entered as Celsius, with the Celsius value as the suggestion', () => {
    const rows = daily('Temperature (24h)', () => 21, (i) => (i >= 10 && i <= 12 ? 70 : 21))
    const flags = only(flagsFor(rows), 'unit-fahrenheit')
    expect(flags).toHaveLength(3)
    expect(flags[0]).toMatchObject({ field: 'target', value: 70, suggestion: 21.1, severity: 'error' })
  })

  it('a fraction entered as a percent, suggesting x100', () => {
    const rows = daily('Drain', () => 35, () => 0.4)
    const flags = only(flagsFor(rows), 'unit-fraction')
    expect(flags).toHaveLength(28)
    expect(flags[0]).toMatchObject({ field: 'target', suggestion: 40 })
  })

  it('a value ten times too big, suggesting a tenth', () => {
    const rows = daily('Plant load', () => 130, (i) => (i === 14 ? 1350 : 130))
    const flags = only(flagsFor(rows), 'unit-factor-10')
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ field: 'target', value: 1350, suggestion: 135 })
  })

  it('a value ten times too small, suggesting x10', () => {
    const rows = daily('Leaf length', (i) => (i === 3 ? 4.1 : 41), () => 40)
    const flags = only(flagsFor(rows), 'unit-factor-10')
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ field: 'actual', value: 4.1, suggestion: 41 })
  })

  it('does not call a normal swing a slip', () => {
    const rows = daily('Leaf length', (i) => 40 + (i % 3), () => 40)
    expect(flagsFor(rows)).toEqual([])
  })
})

describe('jumps against the cultivation\'s own median', () => {
  it('flags more than 2.5x the median and less than 0.4x the median, with no suggestion', () => {
    const rows = daily('Fruit weight', (i) => (i === 5 ? 110 : i === 9 ? 15 : 40), () => 40)
    const flags = only(flagsFor(rows), 'jump-vs-median')
    expect(flags.map((f) => [f.date, f.value, f.suggestion])).toEqual([
      ['2025-06-07', 110, null],
      ['2025-06-11', 15, null],
    ])
  })

  it('leaves 2.4x and 0.45x alone', () => {
    const rows = daily('Fruit weight', (i) => (i === 5 ? 96 : i === 9 ? 18 : 40), () => 40)
    expect(flagsFor(rows)).toEqual([])
  })

  it('only flags too-high Harvest days, never the low weekend ones', () => {
    const rows = daily('Harvest', (i) => (i % 7 === 5 ? 0.04 : i % 7 === 6 ? 0 : i === 2 ? 0.9 : 0.2), (i) => (i % 7 >= 5 ? 0 : 0.2))
    const flags = flagsFor(rows)
    expect(flags.map((f) => [f.date, f.rule])).toEqual([['2025-06-04', 'jump-vs-median']])
  })
})

describe('impossible values', () => {
  it('flags humidity above 100', () => {
    const rows = daily('Relative humidity', (i) => (i === 4 ? 112 : 78), () => 78)
    const flags = only(flagsFor(rows), 'impossible-value')
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ value: 112, field: 'actual', severity: 'error', suggestion: null })
  })

  it('flags a negative amount but not a negative index', () => {
    const water = daily('Irrigation water', (i) => (i === 2 ? -3 : 5), () => null)
    expect(only(flagsFor(water), 'impossible-value')).toHaveLength(1)
    const index = daily('Plant balance factor', (i) => (i % 2 ? -0.4 : 0.3), () => 0)
    expect(flagsFor(index)).toEqual([])
  })

  it('flags pH outside 4 to 9 and accepts 4 and 9 themselves', () => {
    const rows = daily('Drain pH', (i) => (i === 1 ? 3.2 : i === 2 ? 9.6 : i === 3 ? 9 : i === 4 ? 4 : 6.1), () => 5.8)
    const flags = only(flagsFor(rows), 'impossible-value')
    expect(flags.map((f) => f.value)).toEqual([3.2, 9.6])
  })
})

describe('target and actual far apart', () => {
  it('flags the target when a week is more than 2.5x apart, and not at 2x', () => {
    const wide = daily('CO2 (day)', () => 600, () => 1800)
    expect(only(flagsFor(wide), 'target-actual-apart')).toHaveLength(28)
    const ok = daily('CO2 (day)', () => 600, () => 1200)
    expect(flagsFor(ok)).toEqual([])
  })

  it('is not raised by a single dull day inside an otherwise matching week', () => {
    const rows = daily('Irrigation per unit of light', (i) => (i === 3 ? 9 : 2.6), () => 2.6)
    expect(flagsFor(rows)).toEqual([])
  })
})

describe('missing values and zeros', () => {
  it('reports an empty actual as missing, never as zero', () => {
    const rows = daily('CO2 (day)', (i) => (i === 6 ? null : 600), () => 600)
    const flags = flagsFor(rows)
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ rule: 'missing-value', severity: 'info', value: null, date: '2025-06-08' })
  })

  it('ignores zeros in a young cultivation but not in a mature one', () => {
    const zeros = (i: number) => (i < 2 ? 0 : 5)
    expect(flagsFor(daily('Drain EC', zeros, () => null, YOUNG), YOUNG)).toEqual([])
    const mature = only(flagsFor(daily('Drain EC', zeros, () => null)), 'jump-vs-median')
    expect(mature).toHaveLength(2)
  })
})

describe('one flag per cell, grouped for the list', () => {
  const temp = (hot: number[]) => daily('Temperature (24h)', () => 21, (i) => (hot.includes(i) ? 70 : 21))

  it('merges consecutive days into one group and splits at a gap', () => {
    const rows = temp([3, 4, 5, 9, 10])
    const groups = groupFlags(flagsFor(rows), rows)
    expect(groups.map((g) => [g.startDate, g.endDate, g.flags.length])).toEqual([
      ['2025-06-05', '2025-06-07', 3],
      ['2025-06-11', '2025-06-12', 2],
    ])
    expect(groups[0]!.explanation).toMatch(/3 days from 5 Jun 2025 to 7 Jun 2025/)
  })

  it('keeps different columns and rules apart', () => {
    const rows = daily('Drain', (i) => (i === 3 ? 400 : 35), () => 0.4)
    const groups = groupFlags(flagsFor(rows), rows)
    expect(groups.map((g) => [g.field, g.rule, g.flags.length]).sort()).toEqual([
      ['actual', 'unit-factor-10', 1], // 400 is ten times 40
      ['target', 'unit-fraction', 28],
    ])
  })

  it('treats consecutive weeks of a weekly KPI as consecutive', () => {
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const date = addDays('2025-06-02', i * 7)
      return { date, week: isoWeekOf(date), cultivation: MATURE.id, kpi: 'Plant load', actual: 130, target: i === 1 || i === 2 ? 1350 : 130 }
    })
    const groups = groupFlags(flagsFor(weekly), weekly)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ startDate: '2025-06-09', endDate: '2025-06-16' })
  })
})
