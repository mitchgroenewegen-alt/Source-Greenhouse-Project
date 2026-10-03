// The summary at the top of the Facilities screen: one row per facility and one for all of them, each with the
// harvest of the selected week and the harvest since planting against budget. The numbers come from the same
// area-weighted facilityTotal() as the cards below, so the two always agree.

import type { Cultivation } from '../../data/types'
import type { WeeklyPoint } from '../../scoring/effective'
import { facilityTotal, harvestRow, KPI_FOR_PERIOD, toTonnes, type HarvestTotal, type Period } from './facilityTotals'

export const ALL_FACILITIES = 'All facilities'

/** A facility total plus the same numbers in tonnes (kg/m² x area / 1000), both null when nothing can be compared. */
export interface PeriodSummary extends HarvestTotal {
  actualTonnes: number | null
  budgetTonnes: number | null
}

export interface FacilitySummaryRow {
  /** A facility name, or ALL_FACILITIES for the last row. */
  label: string
  /** Id of the facility's card to jump to; null for the all-facilities row, which has no card. */
  cardId: string | null
  cultivationCount: number
  /** Growing area of all the row's cultivations, the same figure the card shows under its name. */
  areaM2: number
  week: PeriodSummary
  cumulative: PeriodSummary
}

/** The DOM id of a facility's card, so the summary can scroll to it. */
export const facilityCardId = (facility: string) => `facility-${facility.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

function summaryRow(
  label: string,
  cardId: string | null,
  cultivations: Cultivation[],
  pointOf: (cultivationId: string, kpi: string) => WeeklyPoint | undefined,
): FacilitySummaryRow {
  const summarise = (period: Period): PeriodSummary => {
    const rows = cultivations.map((c) => harvestRow(c, pointOf(c.id, KPI_FOR_PERIOD[period]), period))
    const total = facilityTotal(rows, period)
    return {
      ...total,
      actualTonnes: total.actual === null ? null : toTonnes(total.actual, total.areaM2),
      budgetTonnes: total.budget === null ? null : toTonnes(total.budget, total.areaM2),
    }
  }
  return {
    label,
    cardId,
    cultivationCount: cultivations.length,
    areaM2: cultivations.reduce((sum, c) => sum + c.areaM2, 0),
    week: summarise('week'),
    cumulative: summarise('cumulative'),
  }
}

/**
 * One row per facility, in the order the facilities first appear (the order of the cards), then "All facilities".
 * `pointOf` gives the weekly point of a cultivation's KPI for the selected week. Both periods are always built,
 * whatever the Harvest toggle below the table says.
 */
export function buildFacilitySummary(
  cultivations: Cultivation[],
  pointOf: (cultivationId: string, kpi: string) => WeeklyPoint | undefined,
): FacilitySummaryRow[] {
  const facilities = [...new Set(cultivations.map((c) => c.facility))]
  return [
    ...facilities.map((facility) =>
      summaryRow(facility, facilityCardId(facility), cultivations.filter((c) => c.facility === facility), pointOf),
    ),
    // The last row weights every cultivation by its area, not the three facility figures.
    summaryRow(ALL_FACILITIES, null, cultivations, pointOf),
  ]
}
