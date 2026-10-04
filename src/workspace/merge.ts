// Lays the workspace over the workbook data: new and edited cultivations, days typed in, and value edits.
// The base is never changed. The weeks, the period and the weekly numbers are worked out again from the merged days
// with the same code the build script uses, so with an empty workspace the result equals the base.

import { buildWeeklyRows, buildWeeks } from '../data/aggregate'
import { addDays, isoWeekOf } from '../data/dates'
import type { Cultivation, DailyRow, DataFile } from '../data/types'
import type { WorkspaceData } from './types'

export type MergeInput = Partial<Pick<WorkspaceData, 'cultivations' | 'valueEdits' | 'enteredRows'>>

export interface MergeOptions {
  /**
   * Leave out value edits made by "Apply correction". The data checks look at the values as recorded and apply the
   * correction themselves through the decision, so they use this view.
   */
  skipCorrected?: boolean
}

/** The longest range one value edit may cover; a guard against a typo like 2205 for 2025. */
const MAX_EDIT_DAYS = 3660

const cellKey = (cultivation: string, kpi: string, date: string) => `${cultivation}|${kpi}|${date}`

function mergeCultivations(base: Cultivation[], workspace: NonNullable<MergeInput['cultivations']>): Cultivation[] {
  const edits = new Map(workspace.map((c) => [c.id, c]))
  const merged: Cultivation[] = base.map((c) => (edits.has(c.id) ? { ...c, ...edits.get(c.id)! } : c))
  const known = new Set(base.map((c) => c.id))
  for (const c of workspace) if (!known.has(c.id)) merged.push(c)
  return merged
}

export function merge(base: DataFile, workspace: MergeInput, options: MergeOptions = {}): DataFile {
  const cultivations = mergeCultivations(base.cultivations, workspace.cultivations ?? [])
  const cultivationIds = new Set(cultivations.map((c) => c.id))
  const kpiNames = new Set(base.kpis.map((k) => k.name))

  const cells = new Map<string, DailyRow>()
  for (const row of base.daily) cells.set(cellKey(row.cultivation, row.kpi, row.date), row)

  for (const e of workspace.enteredRows ?? []) {
    if (!cultivationIds.has(e.cultivation) || !kpiNames.has(e.kpi)) continue
    cells.set(cellKey(e.cultivation, e.kpi, e.date), {
      date: e.date,
      week: isoWeekOf(e.date),
      cultivation: e.cultivation,
      kpi: e.kpi,
      actual: e.actual,
      target: e.target,
    })
  }

  // Oldest edit first, so the newest one wins where they overlap.
  const edits = (workspace.valueEdits ?? [])
    .filter((e) => !(options.skipCorrected && e.source === 'corrected'))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const edit of edits) {
    for (let i = 0, date = edit.dateFrom; date <= edit.dateTo && i < MAX_EDIT_DAYS; i++, date = addDays(date, 1)) {
      const key = cellKey(edit.cultivation, edit.kpi, date)
      const row = cells.get(key)
      if (row) cells.set(key, { ...row, [edit.field]: edit.newValue })
    }
  }

  const cultivationOrder = new Map(cultivations.map((c, i) => [c.id, i]))
  const kpiOrder = new Map(base.kpis.map((k, i) => [k.name, i]))
  const daily = [...cells.values()].sort(
    (a, b) =>
      cultivationOrder.get(a.cultivation)! - cultivationOrder.get(b.cultivation)! ||
      kpiOrder.get(a.kpi)! - kpiOrder.get(b.kpi)! ||
      a.date.localeCompare(b.date),
  )

  const weeks = buildWeeks(daily)
  const dates = [...new Set(daily.map((r) => r.date))].sort()
  return {
    meta: {
      ...base.meta,
      periodStart: dates[0] ?? base.meta.periodStart,
      periodEnd: dates[dates.length - 1] ?? base.meta.periodEnd,
      dayCount: dates.length,
      weekCount: weeks.length,
      cultivationCount: cultivations.length,
    },
    weeks,
    cultivations,
    kpis: base.kpis,
    daily,
    weekly: buildWeeklyRows(daily, base.kpis),
  }
}
