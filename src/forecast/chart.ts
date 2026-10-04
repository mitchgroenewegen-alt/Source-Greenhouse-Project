// The forecast line of the Harvest and Cumulative harvest charts: one point per forecast week, in the chart's unit (kg/m²).

import type { CultivationForecast, Range } from './types'

export interface ChartForecast {
  /** The last recorded week, where the forecast line starts. */
  asOf: string
  /** The value of the line at `asOf`, so the forecast joins the actuals. */
  start: number | null
  points: ({ week: string } & Range)[]
}

/** Harvest per week: each week's low, expected and high. A week that could not be estimated is left out. */
export function weeklyForecastLine(forecast: CultivationForecast, startValue: number | null): ChartForecast {
  return { asOf: forecast.asOf, start: startValue, points: forecast.weeks.map((w) => ({ week: w.week, low: w.low, expected: w.expected, high: w.high })) }
}

/**
 * Cumulative harvest: the harvest to date plus the running sum of the weeks. The line stops at the first week that could not be
 * estimated, since the sum after it would be too low. Null when there is no cumulative harvest to start from.
 */
export function cumulativeForecastLine(forecast: CultivationForecast): ChartForecast | null {
  const toDate = forecast.toDate
  if (toDate === null) return null
  const points: ChartForecast['points'] = []
  let low = toDate
  let expected = toDate
  let high = toDate
  for (const w of forecast.weeks) {
    // `weeks` leaves out weeks without an estimate; the weeks must follow on from the as-of week without a gap.
    if (forecast.missingWeeks.some((m) => m < w.week)) break
    low += w.low
    expected += w.expected
    high += w.high
    points.push({ week: w.week, low, expected, high })
  }
  return { asOf: forecast.asOf, start: toDate, points }
}
