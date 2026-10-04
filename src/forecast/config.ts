// The forecast's settings, all in one place. Change a number here and every screen, the export and the tests' expectations
// that read this file follow.

export const FORECAST = {
  /** How many of the latest weeks the correction factor is worked out from. Fewer comparable weeks than this: no correction. */
  calibrationWeeks: 4,
  /** How many weeks ahead the harvest is forecast. */
  horizonWeeks: 6,
  /**
   * The range around an uncorrected estimate, as a multiple of it. The raw estimate (fruit set x fruit weight) landed between
   * 0.42 and 1.36 of the actual harvest when it was tested on this workbook, so 0.4 to 1.4 holds all of it.
   */
  uncorrectedRange: { low: 0.4, high: 1.4 },
  /**
   * Where a number is needed that has not happened yet (the fruit set of a week after the last data week, the fruit weight
   * and development time of the weeks ahead), the average of this many of the latest weeks that have one is held.
   */
  holdLatestWeeks: 2,
  /**
   * The backtest reruns the forecast as if this week was the last one recorded, and compares it with the real weeks after it
   * (up to the horizon, as far as they were recorded).
   */
  backtestAsOfWeek: '2025-W28',
  /** A week with less actual harvest than this (kg/m²) is left out of the percentage error: a percentage of nearly nothing is not meaningful. */
  minActualForPercentError: 0.05,
} as const
