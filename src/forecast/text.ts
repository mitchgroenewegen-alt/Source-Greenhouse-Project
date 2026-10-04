// The words that go with a forecast, so every screen says the same thing.

import { fixed } from '../lib/format'
import { FORECAST } from './config'
import type { Correction, ForecastMethod, Range } from './types'

export const METHOD_LABEL: Record<ForecastMethod, string> = { corrected: 'Corrected', uncorrected: 'Uncorrected estimate' }

const factor = (value: number) => `×${fixed(value, 2)}`

/** How the forecast was made, in a sentence: the factor and its range, or why there is none. */
export function methodText(correction: Correction): string {
  if (correction.method === 'corrected') {
    return `Corrected by ${factor(correction.factor)} (range ${factor(correction.low)} to ${factor(correction.high)}), what the last ${FORECAST.calibrationWeeks} weeks showed.`
  }
  return `Uncorrected estimate, range ${factor(correction.low)} to ${factor(correction.high)}: ${correction.weeks.length} of the last ${FORECAST.calibrationWeeks} weeks can be compared, and ${FORECAST.calibrationWeeks} are needed to correct it.`
}

/** "10.5 kg/m²" with the range under it where the caller wants it. */
export const rangeText = (range: Range, unit: string, decimals = 1) => `${fixed(range.low, decimals)} to ${fixed(range.high, decimals)} ${unit}`
