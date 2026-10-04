// The raw harvest estimate for one week: the fruit set one fruit development time earlier, times the fruit weight.
//
// Units, checked against src/config/kpis.ts and the workbook:
//   Fruit set     fruits/m²/week  (the week's value is the average of the daily readings of a weekly rate, so it is the fruits
//                                  set per m² in that week)
//   Fruit weight  g               (average over the week's measurements: grams per fruit)
//   Harvest       kg/m²           (sum of the week's days: kg per m² harvested that week)
// fruits/m² x g per fruit = g/m²; / 1000 = kg/m². So  estimate (kg/m² per week) = fruit set x fruit weight / 1000,
// the same unit as Harvest, and the two can be divided to get the correction factor. (Check: Pennsylvania TOV sets about
// 18 fruits/m² a week at about 160 g, which is 2.9 kg/m², and harvests 2 to 3 kg/m² a week.)

import { FORECAST } from './config'
import type { PointOf } from './types'
import { addWeeks } from './weeks'

/** The weekly numbers of one cultivation as they were known at the end of `asOf`: nothing after it is looked at. */
export interface KnownSeries {
  cultivation: string
  asOf: string
  /** The recorded weekly actual; null for a week after `asOf` or when nothing was recorded. */
  actual: (kpi: string, week: string) => number | null
  /** The weekly budget or target, also for weeks after `asOf` (a budget is made ahead of time). */
  target: (kpi: string, week: string) => number | null
  /** The average of the latest recorded actuals up to `week` (and never past `asOf`), or null when there are none in the last 12 weeks. */
  held: (kpi: string, week: string) => number | null
  /** The most recent recorded actual up to `asOf` (not an average), or null when there is none in the last 12 weeks. */
  latest: (kpi: string) => number | null
}

const HOLD_LOOKBACK_WEEKS = 12

export function knownSeries(pointOf: PointOf, cultivation: string, asOf: string): KnownSeries {
  const actual = (kpi: string, week: string) => (week > asOf ? null : (pointOf(cultivation, kpi, week)?.actual ?? null))
  const target = (kpi: string, week: string) => pointOf(cultivation, kpi, week)?.target ?? null
  const held = (kpi: string, week: string) => {
    const values: number[] = []
    let w = week > asOf ? asOf : week
    for (let i = 0; i < HOLD_LOOKBACK_WEEKS && values.length < FORECAST.holdLatestWeeks; i++, w = addWeeks(w, -1)) {
      const v = actual(kpi, w)
      if (v !== null) values.push(v)
    }
    return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
  }
  const latest = (kpi: string) => {
    for (let i = 0, w = asOf; i < HOLD_LOOKBACK_WEEKS; i++, w = addWeeks(w, -1)) {
      const v = actual(kpi, w)
      if (v !== null) return v
    }
    return null
  }
  return { cultivation, asOf, actual, target, held, latest }
}

/** Whole weeks between a fruit being set and being harvested: the development time in days over seven, rounded, at least one. */
export const shiftWeeks = (developmentDays: number) => Math.max(1, Math.round(developmentDays / 7))

export interface WeekEstimate {
  week: string
  /** kg/m² for the week, before any correction. */
  estimate: number
  setWeek: string
  /** The fruit set of `setWeek` is after the last data week, so the latest weeks' fruit set stands in for it. */
  setHeld: boolean
}

/**
 * The raw estimate for `week`, or null when something it needs is not there: the development time, the fruit weight, or the
 * fruit set of the week the fruit was set (a week before the data starts has none).
 *   development time and fruit weight: the week's own recorded value; for a week with none (every week after `asOf`), the
 *                                      latest weeks' average is held.
 *   fruit set: that of the week that is one development time earlier; after `asOf`, the latest weeks' average is held.
 */
export function estimateWeek(series: KnownSeries, week: string): WeekEstimate | null {
  const days = series.actual('Fruit development time', week) ?? series.held('Fruit development time', week)
  if (days === null) return null
  const setWeek = addWeeks(week, -shiftWeeks(days))
  const setHeld = setWeek > series.asOf
  const fruitSet = setHeld ? series.held('Fruit set', series.asOf) : series.actual('Fruit set', setWeek)
  const weight = series.actual('Fruit weight', week) ?? series.held('Fruit weight', week)
  if (fruitSet === null || weight === null) return null
  return { week, estimate: (fruitSet * weight) / 1000, setWeek, setHeld }
}
