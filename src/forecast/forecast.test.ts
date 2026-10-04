import { describe, expect, it } from 'vitest'
import { loadTestData } from '../test/loadData'
import { backtestAll, backtestCultivation } from './backtest'
import { cumulativeForecastLine, weeklyForecastLine } from './chart'
import { FORECAST } from './config'
import { correctionFor } from './correction'
import { estimateWeek, knownSeries, shiftWeeks } from './estimate'
import { forecastAll, forecastCultivation, forecastWeekIds } from './forecast'
import { pointOfData } from './fromData'
import { facilityForecast } from './totals'
import { methodText } from './text'
import type { PointOf } from './types'
import { addWeeks, weeksBetween } from './weeks'

const X = 'X'
/** Week ids W20 to W34 of 2025: the data of the synthetic cultivation. */
const WEEKS = Array.from({ length: 15 }, (_, i) => addWeeks('2025-W20', i))

type Rule = (week: string) => number | null | undefined
interface Spec {
  fruitSet?: Rule
  weight?: Rule
  dev?: Rule
  harvest?: Rule
  harvestBudget?: Rule
  cumulative?: Rule
}

/** A cultivation whose weekly values come from rules; undefined means no row at all. */
function synthetic(spec: Spec): PointOf {
  const byKpi: Record<string, Rule | undefined> = {
    'Fruit set': spec.fruitSet,
    'Fruit weight': spec.weight,
    'Fruit development time': spec.dev,
    Harvest: spec.harvest,
    'Cumulative harvest': spec.cumulative,
  }
  return (cultivation, kpi, week) => {
    if (cultivation !== X) return undefined
    const actual = byKpi[kpi]?.(week)
    const target = kpi === 'Harvest' ? spec.harvestBudget?.(week) : undefined
    if (actual === undefined && target === undefined) return undefined
    return { actual: actual ?? null, target: target ?? null }
  }
}

/** 10 fruits/m² a week at 100 g, harvested 5 weeks later (35 days): the raw estimate is 1 kg/m² a week. */
const steady: Spec = { fruitSet: () => 10, weight: () => 100, dev: () => 35 }
const upTo = (last: string, rule: Rule): Rule => (week) => (week <= last ? rule(week) : undefined)

describe('weeks', () => {
  it('adds and counts ISO weeks across the year end', () => {
    expect(addWeeks('2025-W34', 1)).toBe('2025-W35')
    expect(addWeeks('2025-W01', -1)).toBe('2024-W52')
    expect(addWeeks('2025-W52', 2)).toBe('2026-W02')
    expect(weeksBetween('2025-W34', '2025-W28')).toBe(6)
  })

  it('lists the forecast weeks after the as-of week', () => {
    expect(forecastWeekIds('2025-W34')).toEqual(['2025-W35', '2025-W36', '2025-W37', '2025-W38', '2025-W39', '2025-W40'])
    expect(forecastWeekIds('2025-W34')).toHaveLength(FORECAST.horizonWeeks)
  })
})

describe('the estimate', () => {
  it('is fruit set x fruit weight / 1000, in kg/m² a week', () => {
    // 20 fruits/m² at 150 g = 3000 g/m² = 3 kg/m²
    const series = knownSeries(synthetic({ fruitSet: () => 20, weight: () => 150, dev: () => 35 }), X, '2025-W34')
    expect(estimateWeek(series, '2025-W30')!.estimate).toBeCloseTo(3, 10)
  })

  it('shifts the fruit set by the development time in whole weeks', () => {
    expect(shiftWeeks(36)).toBe(5)
    expect(shiftWeeks(55)).toBe(8)
    expect(shiftWeeks(52.4)).toBe(7)
    expect(shiftWeeks(2)).toBe(1)
    // Only the fruit set of W25 is 20: the fruit harvested five weeks later (W30) comes from it.
    const series = knownSeries(synthetic({ ...steady, fruitSet: (w) => (w === '2025-W25' ? 20 : 10) }), X, '2025-W34')
    const w30 = estimateWeek(series, '2025-W30')!
    expect(w30.setWeek).toBe('2025-W25')
    expect(w30.estimate).toBeCloseTo(2, 10)
    expect(estimateWeek(series, '2025-W31')!.estimate).toBeCloseTo(1, 10)
  })

  it('uses a longer shift for a longer development time', () => {
    const series = knownSeries(synthetic({ ...steady, dev: () => 55, fruitSet: (w) => (w === '2025-W22' ? 30 : 10) }), X, '2025-W34')
    const e = estimateWeek(series, '2025-W30')! // 55 days = 8 weeks, so W22
    expect(e.setWeek).toBe('2025-W22')
    expect(e.estimate).toBeCloseTo(3, 10)
  })

  it('has no estimate when the fruit set of that week was not recorded', () => {
    const series = knownSeries(synthetic({ ...steady, fruitSet: (w) => (w >= '2025-W22' ? 10 : undefined), dev: () => 56 }), X, '2025-W34')
    expect(estimateWeek(series, '2025-W29')).toBeNull() // 8 weeks earlier is W21
    expect(estimateWeek(series, '2025-W30')).not.toBeNull()
  })

  it('holds the latest weeks of fruit set for a week that was not set yet, and never looks past the as-of week', () => {
    // Fruit set recorded to W30 (the as-of week): 10, 10. W31 on is 99 in the data, which must not be seen.
    const spec = { ...steady, fruitSet: (w: string) => (w <= '2025-W29' ? 10 : w === '2025-W30' ? 30 : 99) }
    const series = knownSeries(synthetic(spec), X, '2025-W30')
    const e = estimateWeek(series, '2025-W36')! // set in W31: after the as-of week
    expect(e.setHeld).toBe(true)
    expect(e.estimate).toBeCloseTo(((10 + 30) / 2 * 100) / 1000, 10)
    expect(estimateWeek(series, '2025-W34')!.setHeld).toBe(false) // set in W29
  })
})

describe('the correction factor', () => {
  it('is the real harvest over the estimate across the last 4 weeks, with their spread as the range', () => {
    // Ratios of the last four weeks (W31 to W34): 0.6, 0.8, 1.0, 0.8; estimate 1 each week.
    const ratios: Record<string, number> = { '2025-W31': 0.6, '2025-W32': 0.8, '2025-W33': 1.0, '2025-W34': 0.8 }
    const c = correctionFor(knownSeries(synthetic({ ...steady, harvest: (w) => (w <= '2025-W34' ? (ratios[w] ?? 0.3) : undefined) }), X, '2025-W34'))
    expect(c.method).toBe('corrected')
    expect(c.weeks.map((w) => w.week)).toEqual(['2025-W31', '2025-W32', '2025-W33', '2025-W34'])
    expect(c.factor).toBeCloseTo(0.8, 10)
    expect(c.low).toBeCloseTo(0.6, 10)
    expect(c.high).toBeCloseTo(1.0, 10)
  })

  it('weighs a big week more than a small one (total over total)', () => {
    const spec: Spec = { fruitSet: (w) => (w === '2025-W29' ? 40 : 10), weight: () => 100, dev: () => 35, harvest: (w) => (w <= '2025-W34' ? (w === '2025-W34' ? 2 : 1) : undefined) }
    const c = correctionFor(knownSeries(synthetic(spec), X, '2025-W34'))
    // W34 is set in W29 (40 fruits): its estimate is 4 and the harvest 2. The ratios are 1, 1, 1 and 0.5, but the total ratio is 5/7.
    expect(c.weeks.map((w) => [w.estimate, w.actual])).toEqual([[1, 1], [1, 1], [1, 1], [4, 2]])
    expect(c.factor).toBeCloseTo(5 / 7, 10)
  })

  it('falls back to the uncorrected estimate, with the fixed range, with fewer than 4 comparable weeks', () => {
    // A harvest recorded only in the last three weeks.
    const c = correctionFor(knownSeries(synthetic({ ...steady, harvest: (w) => (w >= '2025-W32' && w <= '2025-W34' ? 0.8 : undefined) }), X, '2025-W34'))
    expect(c.method).toBe('uncorrected')
    expect(c.weeks).toHaveLength(3)
    expect(c.factor).toBe(1)
    expect([c.low, c.high]).toEqual([0.4, 1.4])
  })

  it('does not count a week whose estimate is zero', () => {
    const c = correctionFor(knownSeries(synthetic({ ...steady, fruitSet: (w) => (w === '2025-W29' ? 0 : 10), harvest: (w) => (w <= '2025-W34' ? 0.8 : undefined) }), X, '2025-W34'))
    expect(c.weeks).toHaveLength(3)
    expect(c.method).toBe('uncorrected')
  })
})

describe('the forecast of a cultivation', () => {
  const actuals = upTo('2025-W34', () => 0.8)

  it('multiplies the estimate by the factor and gives a range from the factor spread', () => {
    const rule: Rule = (w) => (w <= '2025-W34' ? ({ '2025-W31': 0.6, '2025-W32': 0.8, '2025-W33': 1.0, '2025-W34': 0.8 } as Record<string, number>)[w] ?? 0.8 : undefined)
    const f = forecastCultivation(X, '2025-W34', WEEKS, synthetic({ ...steady, harvest: rule }))!
    expect(f.correction.method).toBe('corrected')
    expect(f.weeks).toHaveLength(6)
    expect(f.weeks[0]).toMatchObject({ week: '2025-W35', setWeek: '2025-W30', setHeld: false })
    expect(f.weeks.map((w) => w.expected)).toEqual(Array(6).fill(expect.closeTo(0.8, 10)))
    expect(f.weeks[0]!.low).toBeCloseTo(0.6, 10)
    expect(f.weeks[0]!.high).toBeCloseTo(1.0, 10)
    expect(f.total.expected).toBeCloseTo(4.8, 10)
    expect(f.total.low).toBeCloseTo(3.6, 10)
    expect(f.total.high).toBeCloseTo(6, 10)
  })

  it('is the uncorrected estimate with range 0.4 to 1.4 when there are fewer than 4 comparable weeks', () => {
    const f = forecastCultivation(X, '2025-W34', WEEKS, synthetic({ ...steady, harvest: (w) => (w >= '2025-W33' && w <= '2025-W34' ? 0.8 : undefined) }))!
    expect(f.correction.method).toBe('uncorrected')
    expect(f.weeks[0]!.expected).toBeCloseTo(1, 10)
    expect(f.weeks[0]!.low).toBeCloseTo(0.4, 10)
    expect(f.weeks[0]!.high).toBeCloseTo(1.4, 10)
    expect(f.total.expected).toBeCloseTo(6, 10)
  })

  it('has no forecast for a cultivation with no recorded harvest', () => {
    expect(forecastCultivation(X, '2025-W34', WEEKS, synthetic(steady))).toBeNull()
    expect(forecastCultivation('other', '2025-W34', WEEKS, synthetic({ ...steady, harvest: actuals }))).toBeNull()
  })

  it('lists the weeks it could not estimate', () => {
    const f = forecastCultivation(X, '2025-W34', WEEKS, synthetic({ ...steady, weight: () => null, harvest: actuals }))!
    expect(f.weeks).toHaveLength(0)
    expect(f.missingWeeks).toHaveLength(6)
  })

  it('gives no season end without a budget after the last data week, and says why', () => {
    const f = forecastCultivation(X, '2025-W34', WEEKS, synthetic({ ...steady, harvest: actuals, harvestBudget: upTo('2025-W34', () => 1), cumulative: upTo('2025-W34', () => 20) }))!
    expect(f.seasonEnd).toBeNull()
    expect(f.seasonEndNote).toMatch(/needs a Harvest budget/)
    expect(f.seasonEndNote).toMatch(/W34/)
    expect(f.weeks).toHaveLength(6) // the six-week forecast is still there
  })

  it('gives the season end with a budget after the last data week: to date + six weeks + remaining budget x actual/budget', () => {
    // The budget is 1 kg/m² a week for W31 to W46; 0.8 was harvested a week: actual/budget over the last 4 weeks is 0.8.
    const spec = { ...steady, harvest: actuals, cumulative: upTo('2025-W34', () => 20), harvestBudget: (w: string) => (w >= '2025-W31' && w <= '2025-W46' ? 1 : undefined) }
    const f = forecastCultivation(X, '2025-W34', [...WEEKS, ...Array.from({ length: 12 }, (_, i) => addWeeks('2025-W34', i + 1))], synthetic(spec))!
    const end = f.seasonEnd!
    expect(end.toDate).toBe(20)
    expect(end.ratio).toBeCloseTo(0.8, 10)
    expect(end.budgetEndsWeek).toBe('2025-W46')
    expect(end.remainingBudget).toBeCloseTo(6, 10) // W41 to W46: the weeks after the six forecast ones
    expect(end.expected).toBeCloseTo(20 + 6 * 0.8 + 6 * 0.8, 10)
    expect(end.low).toBeLessThanOrEqual(end.expected) // equal here: every week had the same factor
    expect(end.high).toBeGreaterThanOrEqual(end.expected)
    expect(f.seasonEndNote).toBeNull()
  })

  it('has no season end when none of the latest weeks has both an actual and a budget', () => {
    const spec = { ...steady, harvest: actuals, cumulative: upTo('2025-W34', () => 20), harvestBudget: (w: string) => (w >= '2025-W36' ? 1 : undefined) }
    const f = forecastCultivation(X, '2025-W34', [...WEEKS, '2025-W35', '2025-W36', '2025-W37'], synthetic(spec))!
    expect(f.seasonEnd).toBeNull()
    expect(f.seasonEndNote).toMatch(/both an actual and a budget/)
  })
})

describe('the cumulative harvest to date', () => {
  it('is the latest recorded value, not an average of the latest weeks', () => {
    const f = forecastCultivation(X, '2025-W34', WEEKS, synthetic({ ...steady, harvest: upTo('2025-W34', () => 0.8), cumulative: upTo('2025-W34', (w) => weeksBetween(w, '2025-W20') * 10) }))!
    expect(f.toDate).toBe(140)
  })
})

describe('the forecast on the charts and facilities', () => {
  const f = forecastCultivation(X, '2025-W34', WEEKS, synthetic({ ...steady, harvest: upTo('2025-W34', () => 0.8) }))!

  it('draws the weekly line from the weekly values and the cumulative line from the running sum', () => {
    const weekly = weeklyForecastLine(f, 0.8)
    expect(weekly.points).toHaveLength(6)
    const cumulative = cumulativeForecastLine({ ...f, toDate: 20 })!
    expect(cumulative.start).toBe(20)
    expect(cumulative.points[0]!.expected).toBeCloseTo(20 + f.weeks[0]!.expected, 10)
    expect(cumulative.points[5]!.expected).toBeCloseTo(20 + f.total.expected, 10)
    expect(cumulativeForecastLine({ ...f, toDate: null })).toBeNull()
  })

  it('stops the cumulative line before a week that could not be estimated', () => {
    const short = { ...f, weeks: f.weeks.slice(2), missingWeeks: f.weeks.slice(0, 2).map((w) => w.week) }
    expect(cumulativeForecastLine({ ...short, toDate: 20 })!.points).toHaveLength(0)
  })

  it('totals a facility in kg: kg/m² x growing area', () => {
    const cultivation = { id: X, facility: 'F', greenhouse: 'G', crop: 'Tomato', variety: 'V', plantingDate: '2025-01-01', areaM2: 1000, cropWeekAtEnd: 30 }
    const total = facilityForecast([cultivation, { ...cultivation, id: 'Y' }], new Map([[X, f]]))
    expect(total.rows).toHaveLength(1)
    expect(total.total.expected).toBeCloseTo(f.total.expected * 1000, 6)
    expect(total.without).toEqual(['Y'])
  })
})

describe('the backtest', () => {
  // The real harvest is 1.2 kg/m² a week against an estimate of 1.
  const spec = { ...steady, harvest: upTo('2025-W34', () => 1.2) }

  it('reruns the forecast as of an earlier week and compares it with the real weeks after it', () => {
    const b = backtestCultivation(X, '2025-W30', WEEKS, synthetic(spec))!
    // As of W30 only W26 to W30 can be compared (the estimate needs fruit set 5 weeks back; the data starts at W20, so all are there): corrected.
    expect(b.method).toBe('corrected')
    expect(b.weeks.map((w) => w.week)).toEqual(['2025-W31', '2025-W32', '2025-W33', '2025-W34']) // W35 and W36 are not recorded
    expect(b.mape).toBeCloseTo(0, 6)
    expect(b.totalError).toBeCloseTo(0, 6)
    expect(b.inRange).toBe(4)
  })

  it('reports the average absolute percentage error and the total error of an uncorrected forecast', () => {
    // Too little history to correct: the harvest is only recorded from W29, so the window of W27 to W30 is not comparable.
    const b = backtestCultivation(X, '2025-W30', WEEKS, synthetic({ ...steady, harvest: (w) => (w >= '2025-W29' && w <= '2025-W34' ? 1.2 : undefined) }))!
    expect(b.method).toBe('uncorrected')
    // |1 - 1.2| / 1.2 = 16.67 % every week
    expect(b.mape).toBeCloseTo(16.6667, 3)
    expect(b.mapeWeeks).toBe(4)
    expect(b.totalForecast).toBeCloseTo(4, 10)
    expect(b.totalActual).toBeCloseTo(4.8, 10)
    expect(b.totalError).toBeCloseTo(-16.6667, 3) // too low
    expect(b.inRange).toBe(4) // 0.4 to 1.4 holds 1.2
  })

  it('does not let anything recorded after the as-of week into the forecast', () => {
    // Fruit weight is 100 g to W30 and 300 g after: the backtest as of W30 must forecast with 100 g.
    const b = backtestCultivation(X, '2025-W30', WEEKS, synthetic({ ...steady, weight: (w) => (w <= '2025-W30' ? 100 : 300), harvest: upTo('2025-W34', () => 1.2) }))!
    expect(b.weeks[0]!.expected).toBeLessThan(2)
  })

  it('leaves out a cultivation that cannot be forecast as of that week', () => {
    const result = backtestAll([{ id: X }, { id: 'nothing' }], '2025-W30', WEEKS, synthetic(spec))
    expect(result.results.map((r) => r.cultivation)).toEqual([X])
    expect(result.notPossible).toEqual(['nothing'])
    expect([result.from, result.to]).toEqual(['2025-W31', '2025-W36'])
  })
})

describe('on the real workbook', () => {
  const data = loadTestData()
  const pointOf = pointOfData(data)
  const ids = data.weeks.map((w) => w.id)

  it('forecasts six weeks for every cultivation, with the unit of Harvest', () => {
    const forecasts = forecastAll(data.cultivations, data.weeks.at(-1)!.id, ids, pointOf)
    expect(forecasts.size).toBe(data.cultivations.length)
    for (const f of forecasts.values()) {
      expect(f.weeks.length + f.missingWeeks.length).toBe(6)
      // kg/m² a week: the same size as the recorded weekly harvest (under 4 on this workbook)
      for (const w of f.weeks) expect(w.expected).toBeGreaterThanOrEqual(0)
      for (const w of f.weeks) expect(w.expected).toBeLessThan(6)
      expect(f.seasonEnd).toBeNull() // the workbook has no budget after its last week
    }
  })

  it('backtests as of W28 against W29 to W34 and gives an error for each cultivation', () => {
    const b = backtestAll(data.cultivations, FORECAST.backtestAsOfWeek, ids, pointOf)
    expect(b.asOf).toBe('2025-W28')
    expect([b.from, b.to]).toEqual(['2025-W29', '2025-W34'])
    expect(b.results.length).toBeGreaterThanOrEqual(7)
    for (const r of b.results) {
      expect(r.mape, r.cultivation).not.toBeNull()
      expect(Number.isFinite(r.mape!)).toBe(true)
      expect(r.weeks.every((w) => w.week >= '2025-W29' && w.week <= '2025-W34')).toBe(true)
    }
    // Four comparable weeks do not fit between the start of the data (W22) and W28, so every cultivation is uncorrected.
    expect(b.results.every((r) => r.method === 'uncorrected')).toBe(true)
    // Ontario's cherry crop says so, and the young Ontario tomato crop has no estimate as of W28 at all.
    expect(b.results.find((r) => r.cultivation === 'ON-P1-Cherry')!.method).toBe('uncorrected')
    expect(b.notPossible).toEqual(['ON-P1-TOV'])
  })
})

describe('the words', () => {
  it('names the factor and its range when corrected, and why not when uncorrected', () => {
    const corrected = correctionFor(knownSeries(synthetic({ ...steady, harvest: upTo('2025-W34', () => 0.8) }), X, '2025-W34'))
    expect(methodText(corrected)).toBe('Corrected by ×0.80 (range ×0.80 to ×0.80), what the last 4 weeks showed.')
    const uncorrected = correctionFor(knownSeries(synthetic({ ...steady, harvest: (w) => (w >= '2025-W33' && w <= '2025-W34' ? 0.8 : undefined) }), X, '2025-W34'))
    expect(methodText(uncorrected)).toMatch(/^Uncorrected estimate, range ×0\.40 to ×1\.40: 2 of the last 4 weeks/)
  })
})
