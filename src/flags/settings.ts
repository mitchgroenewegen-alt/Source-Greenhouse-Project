// Tuning knobs for the data checks. Change a number here and the Data checks screen follows.

import { kpiConfig } from '../config/kpis'

export const FLAG_THRESHOLDS = {
  /** A value above this many times the cultivation's own median for the KPI is a jump. */
  jumpHigh: 2.5,
  /** A value below this fraction of the cultivation's own median is a jump. */
  jumpLow: 0.4,
  /** Target and actual further apart than this factor (either way) are flagged. */
  apartFactor: 2.5,
  /** A corrected value must land between these multiples of the typical value to count as "looks right". */
  looksRightLow: 0.5,
  looksRightHigh: 2,
  /** In a cultivation's first crop weeks, zeros and low values are normal and are not judged. */
  youngCropWeeks: 10,
  /** pH outside this range is impossible for drain water. */
  phRange: [4, 9] as const,
} as const

export interface KpiFlagSettings {
  /** Zero is an ordinary value (weekend harvest, no heating on a warm day), so never flag a zero. */
  zeroIsNormal: boolean
  /** Which jumps against the median to flag. 'off' for KPIs that legitimately swing with weather or harvest days. */
  jump: 'both' | 'high' | 'off'
  /** Look for unit slips (Fahrenheit, fraction, factor of 10). Off where a big swing is just weather or season. */
  slips: boolean
  /** Hard limits; anything outside is impossible. */
  min?: number
  max?: number
}

const DEFAULTS: KpiFlagSettings = { zeroIsNormal: false, jump: 'both', slips: true, min: 0 }

/** Only the exceptions to DEFAULTS are listed. Why each one is here is written next to it. */
const OVERRIDES: Record<string, Partial<KpiFlagSettings>> = {
  // Harvest is 0 on many weekends and lower on Saturdays and Sundays, so only a too-high day is suspicious.
  Harvest: { zeroIsNormal: true, jump: 'high' },
  // A running total: it starts at 0 and only grows, so "jump against the median" makes no sense.
  'Cumulative harvest': { zeroIsNormal: true, jump: 'off' },
  // Indices run both sides of 0 and the plan is 0, so a ratio to the median means nothing.
  'Plant balance factor': { jump: 'off', min: -1.5, max: 1.5 },
  'Generative trend indicator': { jump: 'off', min: -1.5, max: 1.5 },
  'Temperature (24h)': { min: -10, max: 55 },
  'Temperature (day)': { min: -10, max: 55 },
  'Temperature (night)': { min: -10, max: 55 },
  // Weather and season decide these, so a dark day or a cold spring looks like a "jump" without being an error.
  // They are still checked for impossible values and for a target far from the actual.
  'Solar radiation': { jump: 'off', slips: false },
  'PAR light sum': { jump: 'high', slips: false },
  'RTR (radiation-temperature ratio)': { jump: 'off', slips: false },
  'Irrigation per unit of light': { jump: 'off', slips: false },
  'Irrigation water': { jump: 'high', slips: false },
  'Humidity deficit': { jump: 'off', slips: false },
  'First irrigation after sunrise': { jump: 'off', slips: false },
  'Dry-down at first irrigation': { jump: 'high', slips: false, max: 100 },
  'Day/night temperature difference': { jump: 'off', min: -5, max: 25 },
  // Drain swings from day to day (0 to 77 %), so only an unusually high day counts as a jump.
  Drain: { jump: 'high', max: 100 },
  // No heating on warm days and no LED hours in summer are ordinary zeros, and spring use is ten times summer use.
  'Heating energy (approx.)': { zeroIsNormal: true, jump: 'off', slips: false },
  'LED lighting': { zeroIsNormal: true, jump: 'off', slips: false },
  // Percentages cannot pass 100.
  'Relative humidity': { max: 100 },
  Waste: { max: 100 },
  'Drain pH': { min: FLAG_THRESHOLDS.phRange[0], max: FLAG_THRESHOLDS.phRange[1] },
}

export function flagSettings(kpi: string): KpiFlagSettings {
  return { ...DEFAULTS, ...OVERRIDES[kpi] }
}

/** Which unit slips make sense for a KPI, from its unit. */
export function slipKinds(kpi: string): { fahrenheit: boolean; fraction: boolean } {
  const { unit } = kpiConfig(kpi)
  return {
    fahrenheit: unit === '°C' && kpi !== 'Day/night temperature difference',
    fraction: unit === '%',
  }
}
