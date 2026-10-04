// "How good is this?": the forecast rerun as if an earlier week was the last one recorded, then compared with what was harvested.

import { FORECAST } from './config'
import { forecastCultivation, forecastWeekIds } from './forecast'
import { knownSeries } from './estimate'
import type { Correction, ForecastMethod, PointOf } from './types'

export interface BacktestWeek {
  week: string
  low: number
  expected: number
  high: number
  actual: number
}

export interface CultivationBacktest {
  cultivation: string
  asOf: string
  method: ForecastMethod
  correction: Correction
  /** The forecast weeks that have both an estimate and a recorded harvest. */
  weeks: BacktestWeek[]
  /** Mean absolute percentage error over the weeks with at least `minActualForPercentError` harvested; null when there are none. */
  mape: number | null
  /** How many weeks the MAPE is made from. */
  mapeWeeks: number
  /** All compared weeks together, kg/m²: forecast and actual, and the forecast's miss in percent of the actual (negative: too low). */
  totalForecast: number
  totalActual: number
  totalError: number | null
  /** In how many of the compared weeks the actual harvest fell inside the low to high range. */
  inRange: number
}

/**
 * Forecast `cultivation` as of `asOf`, using only what was known then (see knownSeries), and compare the forecast weeks with the
 * actuals recorded in `pointOf`. Null when the cultivation had no harvest by then, or no forecast week has a recorded harvest.
 */
export function backtestCultivation(cultivation: string, asOf: string, weekIds: string[], pointOf: PointOf): CultivationBacktest | null {
  const forecast = forecastCultivation(cultivation, asOf, weekIds, pointOf)
  if (!forecast) return null
  // Real values, looked up without the "known by asOf" cut-off.
  const real = knownSeries(pointOf, cultivation, weekIds[weekIds.length - 1] ?? asOf)
  const weeks: BacktestWeek[] = []
  for (const f of forecast.weeks) {
    const actual = real.actual('Harvest', f.week)
    if (actual !== null) weeks.push({ week: f.week, low: f.low, expected: f.expected, high: f.high, actual })
  }
  if (weeks.length === 0) return null
  const percentWeeks = weeks.filter((w) => w.actual >= FORECAST.minActualForPercentError)
  const totalForecast = weeks.reduce((s, w) => s + w.expected, 0)
  const totalActual = weeks.reduce((s, w) => s + w.actual, 0)
  return {
    cultivation,
    asOf,
    method: forecast.correction.method,
    correction: forecast.correction,
    weeks,
    mape: percentWeeks.length === 0 ? null : (percentWeeks.reduce((s, w) => s + Math.abs(w.expected - w.actual) / w.actual, 0) / percentWeeks.length) * 100,
    mapeWeeks: percentWeeks.length,
    totalForecast,
    totalActual,
    totalError: totalActual > 0 ? ((totalForecast - totalActual) / totalActual) * 100 : null,
    inRange: weeks.filter((w) => w.actual >= w.low && w.actual <= w.high).length,
  }
}

export interface Backtest {
  asOf: string
  /** The first and last forecast week asked for. */
  from: string
  to: string
  results: CultivationBacktest[]
  /** Cultivations that could not be forecast as of that week (no harvest, or no fruit set, fruit weight or development time by then). */
  notPossible: string[]
}

/** The backtest of every cultivation that can have one. `asOf` is the week to pretend it is (see FORECAST.backtestAsOfWeek). */
export function backtestAll(cultivations: { id: string }[], asOf: string, weekIds: string[], pointOf: PointOf): Backtest {
  const ids = forecastWeekIds(asOf)
  const results: CultivationBacktest[] = []
  const notPossible: string[] = []
  for (const c of cultivations) {
    const result = backtestCultivation(c.id, asOf, weekIds, pointOf)
    if (result) results.push(result)
    else notPossible.push(c.id)
  }
  return { asOf, from: ids[0]!, to: ids[ids.length - 1]!, results, notPossible }
}
