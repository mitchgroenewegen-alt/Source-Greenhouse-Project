// "Copy budgets from...": gives a new cultivation the targets of another one, lined up by crop day.
// Crop day is the number of days since planting, so the source's target on its crop day N becomes the new
// cultivation's target on its crop day N (the same day of the crop's life, whatever the calendar date).

import { addDays, diffDays } from '../data/dates'
import type { Cultivation, DailyRow } from '../data/types'
import type { ValueEdit } from '../workspace/types'
import { fruitTypeIdOf } from './fruitTypes'

/** The id of the value edit for one copied target. It is built from its parts, so copying again replaces the earlier copy. */
export const copyEditId = (target: string, source: string, kpi: string, date: string) => `copy|${target}|${source}|${kpi}|${date}`

/** The cultivations a budget can be copied from: the same fruit type, not the cultivation itself, and with targets of their own. */
export function copySources(target: Cultivation, cultivations: Cultivation[], idsWithTargets: ReadonlySet<string>): Cultivation[] {
  const type = fruitTypeIdOf(target)
  if (type === null) return []
  return cultivations.filter((c) => c.id !== target.id && fruitTypeIdOf(c) === type && idsWithTargets.has(c.id))
}

/**
 * One value edit (field 'target') for every day the source has a target, on the new cultivation's matching crop day.
 * Days the source has no target for are skipped, so nothing is invented, and the copy covers every day the source has,
 * which can run past the end of the period the workbook covers (the app's weeks then grow to include them).
 * `daily` are the merged daily rows (the source's own edits included).
 */
export function budgetCopyEdits(options: {
  source: Pick<Cultivation, 'id' | 'plantingDate'>
  target: Pick<Cultivation, 'id' | 'plantingDate'>
  daily: DailyRow[]
  createdBy: string
  createdAt: string
}): ValueEdit[] {
  const { source, target, daily, createdBy, createdAt } = options
  const edits: ValueEdit[] = []
  for (const row of daily) {
    if (row.cultivation !== source.id || row.target === null) continue
    const cropDay = diffDays(row.date, source.plantingDate)
    if (cropDay < 0) continue
    const date = addDays(target.plantingDate, cropDay)
    edits.push({
      id: copyEditId(target.id, source.id, row.kpi, date),
      cultivation: target.id,
      kpi: row.kpi,
      dateFrom: date,
      dateTo: date,
      field: 'target',
      newValue: row.target,
      originalValue: null,
      createdBy,
      createdAt,
      reason: `Copied from ${source.id}`,
      source: 'edited',
    })
  }
  return edits
}
