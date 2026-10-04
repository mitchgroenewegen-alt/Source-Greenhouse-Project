// Turns what was typed into EnteredRows. An entered row replaces the whole cell of its day (see merge), so a value typed
// for only one of actual and target keeps the other one as the day had it.

import type { DailyRow } from '../data/types'
import type { EnteredRow, ValueSource } from '../workspace/types'

/** One day of one KPI of one cultivation. A value left out (undefined) is not touched; null is not allowed here. */
export interface EntryValue {
  cultivation: string
  kpi: string
  date: string
  actual?: number
  target?: number
}

export const cellKey = (cultivation: string, kpi: string, date: string) => `${cultivation}|${kpi}|${date}`

/** The days as they stand before any value edit, by cultivation, KPI and date. */
export function dayLookup(daily: DailyRow[]): Map<string, DailyRow> {
  return new Map(daily.map((r) => [cellKey(r.cultivation, r.kpi, r.date), r]))
}

/**
 * The rows to save. `before` is the days without value edits, so a budget that was edited stays an edit and is not copied
 * into the entered row (undoing the edit then still works).
 */
export function toEnteredRows(
  values: EntryValue[],
  before: ReadonlyMap<string, DailyRow>,
  meta: { createdBy: string; createdAt: string; source: ValueSource },
): EnteredRow[] {
  return values.map((v) => {
    const current = before.get(cellKey(v.cultivation, v.kpi, v.date))
    return {
      cultivation: v.cultivation,
      date: v.date,
      kpi: v.kpi,
      actual: v.actual ?? current?.actual ?? null,
      target: v.target ?? current?.target ?? null,
      ...meta,
    }
  })
}
