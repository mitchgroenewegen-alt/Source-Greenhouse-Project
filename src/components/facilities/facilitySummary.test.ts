import { describe, expect, it } from 'vitest'
import type { Cultivation } from '../../data/types'
import { detectFlags } from '../../flags'
import { applyDecisions, buildWeekly, weeklyKey, type WeeklyPoint } from '../../scoring/effective'
import { loadTestData } from '../../test/loadData'
import { facilityTotal, harvestRow, KPI_FOR_PERIOD, toTonnes } from './facilityTotals'
import { ALL_FACILITIES, buildFacilitySummary, facilityCardId } from './facilitySummary'

const c = (id: string, facility: string, areaM2: number): Cultivation => ({
  id, facility, greenhouse: 'P1', crop: 'Tomato', variety: 'V', plantingDate: '2025-01-01', areaM2, cropWeekAtEnd: 1,
})
const p = (kpi: string, actual: number | null, target: number | null): WeeklyPoint => ({
  week: '2025-W34', cultivation: 'x', kpi, actual, target, days: 7, paired: actual !== null && target !== null,
  openFlags: 0, decidedFlags: 0, actualMark: null, targetMark: null,
})

/** Points by "cultivation|kpi"; a missing key is a week with no data. */
const lookup = (points: Record<string, [number | null, number | null]>) => (id: string, kpi: string) => {
  const hit = points[`${id}|${kpi}`]
  return hit ? p(kpi, hit[0], hit[1]) : undefined
}

describe('facility summary rows', () => {
  const cultivations = [c('A1', 'Alpha', 10000), c('A2', 'Alpha', 30000), c('B1', 'Beta', 20000)]
  const points = lookup({
    'A1|Harvest': [2, 2], 'A2|Harvest': [1, 2], 'B1|Harvest': [3, 2.4],
    'A1|Cumulative harvest': [20, 20], 'A2|Cumulative harvest': [18, 20], 'B1|Cumulative harvest': [10, 12],
  })
  const rows = buildFacilitySummary(cultivations, points)

  it('has one row per facility in card order, then All facilities', () => {
    expect(rows.map((r) => r.label)).toEqual(['Alpha', 'Beta', ALL_FACILITIES])
    expect(rows.map((r) => r.cardId)).toEqual([facilityCardId('Alpha'), facilityCardId('Beta'), null])
    expect(rows.map((r) => r.cultivationCount)).toEqual([2, 1, 3])
    expect(rows.map((r) => r.areaM2)).toEqual([40000, 20000, 60000])
  })

  it('gives each facility the same area-weighted totals as its card', () => {
    const alpha = rows[0]!
    expect(alpha.week.actual).toBeCloseTo(1.25) // (2*10000 + 1*30000) / 40000
    expect(alpha.week.budget).toBeCloseTo(2)
    expect(alpha.week.variance).toBeCloseTo(-37.5)
    expect(alpha.week.status).toBe('red')
    expect(alpha.cumulative.actual).toBeCloseTo(18.5) // (20*10000 + 18*30000) / 40000
    expect(alpha.cumulative.budget).toBeCloseTo(20)
    expect(alpha.cumulative.variance).toBeCloseTo(-7.5)
    expect(alpha.cumulative.status).toBe('amber')
    const cardTotal = facilityTotal(cultivations.slice(0, 2).map((x) => harvestRow(x, points(x.id, KPI_FOR_PERIOD.week), 'week')), 'week')
    expect(alpha.week).toMatchObject({ areaM2: cardTotal.areaM2, actual: cardTotal.actual, budget: cardTotal.budget, variance: cardTotal.variance, status: cardTotal.status })
  })

  it('builds All facilities from every cultivation weighted by area, not from the facility figures', () => {
    const all = rows[2]!
    expect(all.week.areaM2).toBe(60000)
    expect(all.week.actual).toBeCloseTo((2 * 10000 + 1 * 30000 + 3 * 20000) / 60000) // 1.8333
    expect(all.week.budget).toBeCloseTo((2 * 10000 + 2 * 30000 + 2.4 * 20000) / 60000) // 2.1333
    expect(all.week.variance).toBeCloseTo(((110000 - 128000) / 128000) * 100) // -14.06
    expect(all.week.status).toBe('red')
    // Averaging the two facility figures would give a different answer: (1.25 + 3) / 2 = 2.125.
    expect(all.week.actual).not.toBeCloseTo((rows[0]!.week.actual! + rows[1]!.week.actual!) / 2)
    expect(all.cumulative.actual).toBeCloseTo((20 * 10000 + 18 * 30000 + 10 * 20000) / 60000)
  })

  it('always holds both periods, and the cumulative one reads Cumulative harvest, not Harvest', () => {
    const beta = rows[1]!
    expect(beta.week).toMatchObject({ actual: 3, budget: 2.4, status: 'green' })
    expect(beta.cumulative).toMatchObject({ actual: 10, budget: 12, status: 'red' }) // -16.7 % is beyond the 8 % amber limit
    expect(beta.cumulative.variance).toBeCloseTo(-16.67, 1)
  })

  it('gives tonnes as kg/m2 x area / 1000, and the facilities add up to All facilities', () => {
    const alpha = rows[0]!
    expect(alpha.week.actualTonnes).toBeCloseTo(toTonnes(1.25, 40000)) // 50 t
    expect(alpha.week.budgetTonnes).toBeCloseTo(80)
    expect(rows[1]!.week.actualTonnes).toBeCloseTo(60)
    expect(rows[2]!.week.actualTonnes).toBeCloseTo(110)
    expect(rows[2]!.week.actualTonnes).toBeCloseTo(alpha.week.actualTonnes! + rows[1]!.week.actualTonnes!)
    expect(rows[2]!.week.budgetTonnes).toBeCloseTo(alpha.week.budgetTonnes! + rows[1]!.week.budgetTonnes!)
  })
})

describe('facility summary with gaps', () => {
  it('leaves a cultivation without a comparable week out of the weighting but still counts it', () => {
    const cultivations = [c('A1', 'Alpha', 10000), c('A2', 'Alpha', 30000)]
    const rows = buildFacilitySummary(cultivations, lookup({ 'A1|Harvest': [2, 2], 'A2|Harvest': [null, 2] }))
    expect(rows[0]).toMatchObject({ cultivationCount: 2, areaM2: 40000 }) // the heading figures include A2
    expect(rows[0]!.week).toMatchObject({ areaM2: 10000, actual: 2, budget: 2, status: 'green' }) // the totals do not
    expect(rows[1]!.week.areaM2).toBe(10000) // All facilities follows the same rule
  })

  it('has no figures and no status for a period nothing can be compared in', () => {
    const rows = buildFacilitySummary([c('A1', 'Alpha', 10000)], lookup({ 'A1|Harvest': [2, 2] }))
    expect(rows[0]!.week.status).toBe('green')
    expect(rows[0]!.cumulative).toEqual({ areaM2: 0, actual: null, budget: null, variance: null, status: null, actualTonnes: null, budgetTonnes: null })
  })

  it('still ends with an All facilities row when there are no cultivations', () => {
    const rows = buildFacilitySummary([], () => undefined)
    expect(rows.map((r) => r.label)).toEqual([ALL_FACILITIES])
    expect(rows[0]).toMatchObject({ cultivationCount: 0, areaM2: 0 })
  })

  it('makes a card id that is safe in a URL fragment', () => {
    expect(facilityCardId('Pennsylvania')).toBe('facility-pennsylvania')
    expect(facilityCardId('New South Wales')).toBe('facility-new-south-wales')
  })
})

describe('facility summary on the real data (W34)', () => {
  const data = loadTestData()
  const weekly = buildWeekly(applyDecisions(data.daily, detectFlags(data.daily, data.cultivations), [], false))
  const rows = buildFacilitySummary(data.cultivations, (id, kpi) => weekly.get(weeklyKey(id, kpi, '2025-W34')))

  it('lists Pennsylvania, Arizona and Ontario, then All facilities', () => {
    expect(rows.map((r) => r.label)).toEqual(['Pennsylvania', 'Arizona', 'Ontario', ALL_FACILITIES])
    expect(rows.map((r) => r.cultivationCount)).toEqual([3, 3, 2, 8])
  })

  it('adds up: the facilities in tonnes equal All facilities, for the week and since planting', () => {
    const [pa, az, on, all] = rows as [typeof rows[0], typeof rows[0], typeof rows[0], typeof rows[0]]
    for (const period of ['week', 'cumulative'] as const) {
      expect(pa[period].actualTonnes! + az[period].actualTonnes! + on[period].actualTonnes!).toBeCloseTo(all[period].actualTonnes!, 6)
      expect(pa[period].budgetTonnes! + az[period].budgetTonnes! + on[period].budgetTonnes!).toBeCloseTo(all[period].budgetTonnes!, 6)
    }
  })

  it('scores every row for both periods', () => {
    for (const row of rows) for (const period of ['week', 'cumulative'] as const) expect(row[period].status, `${row.label} ${period}`).not.toBeNull()
  })
})
