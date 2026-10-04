// The harvest forecast of one cultivation, and its season-end figure when a budget runs past the data.

import { kpiConfig, planWord } from '../config/kpis'
import { shortWeek } from '../data/dates'
import { correctionFor } from './correction'
import { FORECAST } from './config'
import { estimateWeek, knownSeries, type KnownSeries } from './estimate'
import type { CultivationForecast, ForecastWeek, PointOf, Range, SeasonEnd } from './types'
import { addWeeks } from './weeks'

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

/** The forecast weeks: the `horizonWeeks` weeks after `asOf`. */
export const forecastWeekIds = (asOf: string): string[] => Array.from({ length: FORECAST.horizonWeeks }, (_, i) => addWeeks(asOf, i + 1))

/**
 * Season end = harvest to date + the weeks forecast + the budget for the rest of the season x how the last weeks went against
 * their budget (actual / budget over the latest weeks that have both). It needs a Harvest budget after the last data week; with
 * none (the workbook's stops at the last week) there is no season end and the note says why.
 */
function seasonEndOf(series: KnownSeries, weekIds: string[], total: Range): { seasonEnd: SeasonEnd | null; note: string | null } {
  const plan = planWord(kpiConfig('Harvest'))
  const budgetWeeks = weekIds.filter((w) => w > series.asOf && series.target('Harvest', w) !== null).sort()
  if (budgetWeeks.length === 0) return { seasonEnd: null, note: `The season end needs a Harvest ${plan} for the weeks after ${shortWeek(series.asOf)}, and there is none.` }

  const toDate = series.held('Cumulative harvest', series.asOf)
  if (toDate === null) return { seasonEnd: null, note: 'No cumulative harvest is recorded yet, so there is nothing to add the forecast to.' }

  let actual = 0
  let budget = 0
  for (let i = 0, w = series.asOf; i < FORECAST.calibrationWeeks; i++, w = addWeeks(w, -1)) {
    const a = series.actual('Harvest', w)
    const t = series.target('Harvest', w)
    if (a !== null && t !== null) {
      actual += a
      budget += t
    }
  }
  if (budget <= 0) return { seasonEnd: null, note: `None of the latest weeks has both an actual and a ${plan}, so how the season is going against its ${plan} cannot be worked out.` }

  const windowEnd = addWeeks(series.asOf, FORECAST.horizonWeeks)
  const remainingBudget = sum(budgetWeeks.filter((w) => w > windowEnd).map((w) => series.target('Harvest', w)!))
  const ratio = actual / budget
  const rest = remainingBudget * ratio
  return {
    seasonEnd: {
      toDate,
      remainingBudget,
      ratio,
      expected: toDate + total.expected + rest,
      low: toDate + total.low + rest,
      high: toDate + total.high + rest,
      budgetEndsWeek: budgetWeeks[budgetWeeks.length - 1]!,
    },
    note: null,
  }
}

/**
 * The forecast of one cultivation as it stood at the end of `asOf` (the live forecast uses the last week with a recorded value;
 * the backtest an earlier one). `weekIds` are the weeks the data has, only used to find a budget after `asOf`. Returns null for a cultivation with no
 * recorded harvest up to `asOf`: there is nothing to forecast from.
 */
export function forecastCultivation(cultivation: string, asOf: string, weekIds: string[], pointOf: PointOf): CultivationForecast | null {
  const series = knownSeries(pointOf, cultivation, asOf)
  const hasHarvest = weekIds.some((w) => w <= asOf && series.actual('Harvest', w) !== null)
  if (!hasHarvest) return null

  const correction = correctionFor(series)
  const weeks: ForecastWeek[] = []
  const missingWeeks: string[] = []
  for (const week of forecastWeekIds(asOf)) {
    const e = estimateWeek(series, week)
    if (!e) {
      missingWeeks.push(week)
      continue
    }
    weeks.push({
      week,
      estimate: e.estimate,
      setWeek: e.setWeek,
      setHeld: e.setHeld,
      low: e.estimate * correction.low,
      expected: e.estimate * correction.factor,
      high: e.estimate * correction.high,
    })
  }
  const total: Range = { low: sum(weeks.map((w) => w.low)), expected: sum(weeks.map((w) => w.expected)), high: sum(weeks.map((w) => w.high)) }
  const { seasonEnd, note } = seasonEndOf(series, weekIds, total)
  return { cultivation, asOf, correction, weeks, missingWeeks, total, seasonEnd, seasonEndNote: note }
}

/** The forecast of each of the cultivations that has one, by cultivation id. */
export function forecastAll(cultivations: { id: string }[], asOf: string, weekIds: string[], pointOf: PointOf): Map<string, CultivationForecast> {
  const forecasts = new Map<string, CultivationForecast>()
  for (const c of cultivations) {
    const f = forecastCultivation(c.id, asOf, weekIds, pointOf)
    if (f) forecasts.set(c.id, f)
  }
  return forecasts
}
