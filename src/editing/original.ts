// What a budget or target was before it was edited, so a chart can show both and a table can mark the edited weeks.

import { merge, type MergeInput } from '../workspace/merge'
import type { DataFile } from '../data/types'
import type { ValueEdit } from '../workspace/types'
import { weeklyKey } from '../scoring/effective'

/**
 * An edit made on purpose to a budget or target. Budgets copied onto a new cultivation are also edits of source 'edited',
 * but they are how that cultivation gets its budget at all, so there is no earlier value to show next to them.
 */
export const isPlanEdit = (e: ValueEdit): boolean => e.source === 'edited' && e.field === 'target' && !isCopyEdit(e)

/** A budget copied from another cultivation (see src/setup/copyBudgets.ts). */
export const isCopyEdit = (e: ValueEdit): boolean => e.id.startsWith('copy|')

/**
 * The days as recorded, for "Show raw data": the workbook plus the cultivations and days entered in the app, with every
 * value edit left out. Only the budgets copied onto a new cultivation stay, because without them it has no budget at all.
 */
export function recordedValues(base: DataFile, workspace: MergeInput): DataFile {
  return merge(base, { ...workspace, valueEdits: (workspace.valueEdits ?? []).filter(isCopyEdit) })
}

/** A week where the budget or target was edited, and what it was before (null: it had none). */
export interface EditedWeek {
  original: number | null
}

const SAME_WITHIN = 1e-9

/**
 * The weeks in which the edits changed the weekly budget or target, by "cultivation|kpi|week" (see weeklyKey).
 * Empty without edits, and then no second merge is made.
 */
export function editedWeeks(base: DataFile, workspace: MergeInput, merged: DataFile): ReadonlyMap<string, EditedWeek> {
  const edits = workspace.valueEdits ?? []
  if (!edits.some(isPlanEdit)) return new Map()
  const before = merge(base, { ...workspace, valueEdits: edits.filter((e) => !isPlanEdit(e)) })
  const original = new Map(before.weekly.map((w) => [weeklyKey(w.cultivation, w.kpi, w.week), w.target]))
  const found = new Map<string, EditedWeek>()
  for (const w of merged.weekly) {
    const key = weeklyKey(w.cultivation, w.kpi, w.week)
    const was = original.get(key) ?? null
    if (was === null ? w.target !== null : w.target === null || Math.abs(w.target - was) > SAME_WITHIN) found.set(key, { original: was })
  }
  return found
}
