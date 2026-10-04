/** One weekly value of a cultivation, as the scores have it. The app passes its `point` lookup (flagged values left out, decisions applied). */
export type PointOf = (cultivation: string, kpi: string, week: string) => { actual: number | null; target: number | null } | undefined

export type ForecastMethod = 'corrected' | 'uncorrected'

/** A range around an expected value. All in kg/m² unless a field says otherwise. */
export interface Range {
  low: number
  expected: number
  high: number
}

export interface ForecastWeek extends Range {
  week: string
  /** The raw estimate for the week: fruit set x fruit weight / 1000, before the correction factor. */
  estimate: number
  /** The week in which the fruit that is harvested this week was set. */
  setWeek: string
  /** True when that fruit set is not recorded yet (it lies after the last data week), so the latest weeks' fruit set is held. */
  setHeld: boolean
}

/** A past week used to work out the correction factor. */
export interface CalibrationWeek {
  week: string
  estimate: number
  actual: number
  /** actual / estimate */
  ratio: number
}

export interface Correction {
  method: ForecastMethod
  /** What the estimate is multiplied by: 1 when uncorrected. */
  factor: number
  /** The range of the factor: its spread over the calibration weeks, or the fixed range when uncorrected. */
  low: number
  high: number
  /** The weeks the factor is made from (the comparable ones among the latest weeks). */
  weeks: CalibrationWeek[]
}

export interface SeasonEnd {
  /** Cumulative harvest to date, kg/m². */
  toDate: number
  /** Budget in the weeks after the forecast window, kg/m². */
  remainingBudget: number
  /** Actual / budget over the latest weeks that have both. */
  ratio: number
  /** to date + the six weeks + remaining budget x ratio. */
  expected: number
  /** The six-week range around the same figures. */
  low: number
  high: number
  /** The last week of the budget. */
  budgetEndsWeek: string
}

export interface CultivationForecast {
  cultivation: string
  /** The last week that counts as known. */
  asOf: string
  /** The cumulative harvest recorded at the end of `asOf` (the latest one, when that week has none), kg/m²; the cumulative chart's forecast starts from it. */
  toDate: number | null
  correction: Correction
  /** One entry per forecast week that could be estimated, in order. */
  weeks: ForecastWeek[]
  /** Forecast weeks that could not be estimated (no fruit set that far back, or no fruit weight or development time). */
  missingWeeks: string[]
  /** The sum of the forecast weeks, kg/m². */
  total: Range
  /** Null unless the Harvest budget runs on after the last data week. */
  seasonEnd: SeasonEnd | null
  /** Why there is no season-end figure, in words. */
  seasonEndNote: string | null
}
