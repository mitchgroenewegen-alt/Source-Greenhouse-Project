// Cultivations that share a greenhouse. Ontario's Cherry and TOV share Phase 1 but score a different climate on most days, which
// raises the question whether that is the crops, a sensor or the data. Any cultivation with a neighbour in the same greenhouse
// gets the overlay, not only Ontario's.

import { kpiConfig } from '../config/kpis'
import type { Cultivation } from '../data/types'
import { CLIMATE_KPIS } from './kpis'
import type { DayTable } from './days'

/** The other live cultivations of the same facility and greenhouse (archived ones are history, not neighbours). */
export function sharedGreenhouse(id: string, cultivations: readonly Cultivation[]): Cultivation[] {
  const own = cultivations.find((c) => c.id === id)
  if (!own) return []
  return cultivations.filter((c) => c.id !== id && !c.archived && c.facility === own.facility && c.greenhouse === own.greenhouse)
}

/** What tells two crops apart on a chart: "Cherry (ON-P1-Cherry)". */
export const cultivationName = (c: Pick<Cultivation, 'id' | 'variety'>) => `${c.variety} (${c.id})`

export interface OverlayDay {
  date: string
  label: string
  a: number | null
  b: number | null
}

/**
 * Do two readings of the same KPI differ by more than its green tolerance? The tolerance is the KPI's own (kpis.ts): a number
 * of units for absolute KPIs, a percentage of the larger magnitude of the two for percent KPIs. False when one is missing.
 */
export function differs(kpi: string, a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false
  const config = kpiConfig(kpi)
  const gap = Math.abs(a - b)
  if (config.variance === 'absolute') return gap > config.green + 1e-9
  const scale = Math.max(Math.abs(a), Math.abs(b))
  return scale === 0 ? false : (gap / scale) * 100 > config.green + 1e-9
}

export interface OverlayShare {
  /** Days (or, across KPIs, day and KPI pairs) where both cultivations have a value. */
  compared: number
  /** Of those, where the two values are not the same. Same air, same sensor should read the same, so this is the plain question. */
  different: number
  /** Of those, where they differ by more than the KPI's green tolerance: a gap a grower would steer on. */
  beyondTolerance: number
}

const NOTHING: OverlayShare = { compared: 0, different: 0, beyondTolerance: 0 }

const add = (total: OverlayShare, kpi: string, x: number | null, y: number | null): OverlayShare => {
  if (x === null || y === null) return total
  return {
    compared: total.compared + 1,
    different: total.different + (Math.abs(x - y) > 1e-9 ? 1 : 0),
    beyondTolerance: total.beyondTolerance + (differs(kpi, x, y) ? 1 : 0),
  }
}

/** How many of the days with both values differ at all, and by more than the KPI's green tolerance. */
export function overlayShare(kpi: string, a: DayTable, b: DayTable, dates: readonly string[]): OverlayShare {
  let share = NOTHING
  for (const date of dates) share = add(share, kpi, a.get(kpi)?.get(date)?.actual ?? null, b.get(kpi)?.get(date)?.actual ?? null)
  return share
}

/**
 * The same over all the climate KPIs together: every day and KPI where both cultivations have a value is one comparison. This is
 * the share behind "the two climates differ on most days" (86 % of the comparisons in the data the app shipped with). Solar
 * radiation is measured outside, so it is identical for both and counts as a comparison that does not differ.
 */
export function overlayShareAll(a: DayTable, b: DayTable, dates: readonly string[]): OverlayShare {
  let share = NOTHING
  for (const { name } of CLIMATE_KPIS) for (const date of dates) share = add(share, name, a.get(name)?.get(date)?.actual ?? null, b.get(name)?.get(date)?.actual ?? null)
  return share
}

export function overlaySeries(kpi: string, a: DayTable, b: DayTable, dates: readonly string[], labelOf: (date: string) => string): OverlayDay[] {
  return dates.map((date) => ({ date, label: labelOf(date), a: a.get(kpi)?.get(date)?.actual ?? null, b: b.get(kpi)?.get(date)?.actual ?? null }))
}
