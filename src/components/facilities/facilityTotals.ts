// Harvest against budget per cultivation, and the area-weighted total for a facility.

import type { Cultivation } from '../../data/types'
import type { WeeklyPoint } from '../../scoring/effective'
import { scoreKpi, type Status } from '../../scoring/score'

export type Period = 'week' | 'cumulative'

export interface HarvestRow {
  cultivation: Cultivation
  /** kg/m2 */
  actual: number | null
  /** kg/m2 */
  budget: number | null
  variance: number | null
  status: Status | null
}

export interface HarvestTotal {
  areaM2: number
  actual: number | null
  budget: number | null
  variance: number | null
  status: Status | null
}

export const KPI_FOR_PERIOD: Record<Period, string> = { week: 'Harvest', cumulative: 'Cumulative harvest' }

/** Tonnes from kg/m2 and area: kg/m2 x m2 / 1000. */
export const toTonnes = (kgPerM2: number, areaM2: number) => (kgPerM2 * areaM2) / 1000

export function harvestRow(cultivation: Cultivation, point: WeeklyPoint | undefined, period: Period): HarvestRow {
  // Only a week where actual and budget come from the same days can be compared.
  const actual = point?.paired ? point.actual : null
  const budget = point?.paired ? point.target : null
  const score = scoreKpi(KPI_FOR_PERIOD[period], actual, budget)
  return { cultivation, actual, budget, variance: score.variance, status: score.status }
}

/** Area-weighted kg/m2 over the cultivations that have both numbers, so actual and budget cover the same ground. */
export function facilityTotal(rows: HarvestRow[], period: Period): HarvestTotal {
  const usable = rows.filter((r) => r.actual !== null && r.budget !== null)
  const areaM2 = usable.reduce((sum, r) => sum + r.cultivation.areaM2, 0)
  if (usable.length === 0 || areaM2 === 0) return { areaM2: 0, actual: null, budget: null, variance: null, status: null }
  const weighted = (pick: (r: HarvestRow) => number) => usable.reduce((sum, r) => sum + pick(r) * r.cultivation.areaM2, 0) / areaM2
  const actual = weighted((r) => r.actual!)
  const budget = weighted((r) => r.budget!)
  const score = scoreKpi(KPI_FOR_PERIOD[period], actual, budget)
  return { areaM2, actual, budget, variance: score.variance, status: score.status }
}

