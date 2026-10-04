// The per-cultivation correction factor: how the raw estimate has compared with the real harvest lately.

import { FORECAST } from './config'
import { estimateWeek, type KnownSeries } from './estimate'
import type { CalibrationWeek, Correction } from './types'
import { addWeeks } from './weeks'

/** The latest `calibrationWeeks` weeks up to and including the as-of week, oldest first. */
export const calibrationWindow = (asOf: string, count: number = FORECAST.calibrationWeeks): string[] =>
  Array.from({ length: count }, (_, i) => addWeeks(asOf, i - count + 1))

/**
 * The comparable weeks among the calibration window: a harvest was recorded and the estimate exists and is above zero (a ratio
 * to nothing means nothing). With every week of the window comparable, the factor is the real harvest over the estimate across
 * those weeks (total over total, so a small week counts for less) and its range is the lowest and highest single week.
 * With fewer, there is too little to judge the estimate by: no correction, and the fixed wide range.
 */
export function correctionFor(series: KnownSeries): Correction {
  const weeks: CalibrationWeek[] = []
  for (const week of calibrationWindow(series.asOf)) {
    const actual = series.actual('Harvest', week)
    const estimate = estimateWeek(series, week)?.estimate
    if (actual !== null && estimate !== undefined && estimate > 0) weeks.push({ week, estimate, actual, ratio: actual / estimate })
  }
  if (weeks.length < FORECAST.calibrationWeeks) {
    return { method: 'uncorrected', factor: 1, low: FORECAST.uncorrectedRange.low, high: FORECAST.uncorrectedRange.high, weeks }
  }
  const ratios = weeks.map((w) => w.ratio)
  return {
    method: 'corrected',
    factor: weeks.reduce((s, w) => s + w.actual, 0) / weeks.reduce((s, w) => s + w.estimate, 0),
    low: Math.min(...ratios),
    high: Math.max(...ratios),
    weeks,
  }
}
