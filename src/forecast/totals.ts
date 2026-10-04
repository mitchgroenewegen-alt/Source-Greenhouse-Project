// Forecast totals in kg for a facility: kg/m² x growing area, summed over its cultivations.

import type { Cultivation } from '../data/types'
import type { CultivationForecast, Range } from './types'

export interface FacilityForecastRow {
  cultivation: Cultivation
  /** kg for the whole forecast window. */
  kg: Range
  method: CultivationForecast['correction']['method']
}

export interface FacilityForecast {
  rows: FacilityForecastRow[]
  /** The sum of the rows (the low and the high are the sums of the lows and highs: the widest the facility could land). */
  total: Range
  /** Cultivations of the facility that have no forecast. */
  without: string[]
}

export function facilityForecast(cultivations: Cultivation[], forecasts: ReadonlyMap<string, CultivationForecast>): FacilityForecast {
  const rows: FacilityForecastRow[] = []
  const without: string[] = []
  for (const cultivation of cultivations) {
    const f = forecasts.get(cultivation.id)
    if (!f || f.weeks.length === 0) {
      without.push(cultivation.id)
      continue
    }
    const kg = (perM2: number) => perM2 * cultivation.areaM2
    rows.push({ cultivation, kg: { low: kg(f.total.low), expected: kg(f.total.expected), high: kg(f.total.high) }, method: f.correction.method })
  }
  const add = (pick: (r: Range) => number) => rows.reduce((s, r) => s + pick(r.kg), 0)
  return { rows, total: { low: add((r) => r.low), expected: add((r) => r.expected), high: add((r) => r.high) }, without }
}
