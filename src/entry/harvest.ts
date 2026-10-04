// Daily production is typed either as kg/m² (what the Harvest KPI holds) or as a total in kg for the whole cultivation.

import { round } from '../data/aggregate'

/** A total in kg over a growing area in m², as kg/m². null when the area is not a positive number. */
export function kgToKgPerM2(totalKg: number, areaM2: number): number | null {
  if (!Number.isFinite(totalKg) || !(areaM2 > 0)) return null
  return round(totalKg / areaM2, 6)
}
