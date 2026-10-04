// What an import would do, worked out before anything is saved: which days are new, which change a value, which are
// the same already (skipped), and how many of the new values the data checks would flag. Pure.

import { isoWeekOf } from '../data/dates'
import { detectFlags } from '../flags'
import type { Cultivation, DailyRow } from '../data/types'
import type { EnteredRow } from '../workspace/types'
import type { ImportProblem, ParsedRow, ParseResult } from './parse'

export interface Values {
  actual: number | null
  target: number | null
}

/** A day the file would add or change. `before` is null for a new day. */
export interface PreviewRow {
  row: ParsedRow
  before: Values | null
  after: Values
}

export interface FlaggedExample {
  cultivation: string
  kpi: string
  date: string
  explanation: string
}

export interface ImportPreview {
  newRows: PreviewRow[]
  changedRows: PreviewRow[]
  /** Days the file has that are the same as now; they are skipped. */
  unchanged: number
  problems: ImportProblem[]
  /** How many of the new and changed values the data checks would flag (missing values are not counted). */
  flagged: number
  flaggedExamples: FlaggedExample[]
}

const SAME_WITHIN = 1e-9
const same = (a: number | null, b: number | null) => a === b || (a !== null && b !== null && Math.abs(a - b) <= SAME_WITHIN)
const cellKey = (cultivation: string, kpi: string, date: string) => `${cultivation}|${kpi}|${date}`

/**
 * Compare the file with the days as they are now (`current`, edits included). An empty cell in the file leaves the day's
 * value as it is, so a file with only actuals does not wipe the budgets; on a new day an empty cell is just empty.
 */
export function previewImport(parsed: ParseResult, current: DailyRow[], cultivations: Cultivation[]): ImportPreview {
  const byCell = new Map(current.map((r) => [cellKey(r.cultivation, r.kpi, r.date), r]))
  const preview: ImportPreview = { newRows: [], changedRows: [], unchanged: 0, problems: parsed.problems, flagged: 0, flaggedExamples: [] }

  for (const row of parsed.rows) {
    const now = byCell.get(cellKey(row.cultivation, row.kpi, row.date))
    const after: Values = { actual: row.actual ?? now?.actual ?? null, target: row.target ?? now?.target ?? null }
    if (!now) {
      if (after.actual === null && after.target === null) preview.unchanged++ // nothing to add
      else preview.newRows.push({ row, before: null, after })
    } else if (same(now.actual, after.actual) && same(now.target, after.target)) preview.unchanged++
    else preview.changedRows.push({ row, before: { actual: now.actual, target: now.target }, after })
  }

  const flagged = flagsFor([...preview.newRows, ...preview.changedRows], current, cultivations)
  preview.flagged = flagged.length
  preview.flaggedExamples = flagged.slice(0, 5)
  return preview
}

/** Run the data checks on each cultivation and KPI the file touches, as it would be after the import. */
function flagsFor(rows: PreviewRow[], current: DailyRow[], cultivations: Cultivation[]): FlaggedExample[] {
  if (rows.length === 0) return []
  const touched = new Map<string, PreviewRow[]>()
  for (const r of rows) {
    const key = `${r.row.cultivation}|${r.row.kpi}`
    touched.set(key, [...(touched.get(key) ?? []), r])
  }
  const series = new Map<string, DailyRow[]>()
  for (const r of current) {
    const key = `${r.cultivation}|${r.kpi}`
    if (!touched.has(key)) continue
    const list = series.get(key)
    if (list) list.push(r)
    else series.set(key, [r])
  }

  const found: FlaggedExample[] = []
  for (const [key, changes] of touched) {
    const first = changes[0]!.row
    const cultivation = cultivations.find((c) => c.id === first.cultivation)
    if (!cultivation) continue
    const after = new Map((series.get(key) ?? []).map((r) => [r.date, r]))
    // The cells whose value the file sets or changes: only those can be blamed on it.
    const cells = new Set<string>()
    for (const { row, before, after: values } of changes) {
      after.set(row.date, { date: row.date, week: '', cultivation: row.cultivation, kpi: row.kpi, ...values })
      if (!before || !same(before.actual, values.actual)) cells.add(`${row.date}|actual`)
      if (!before || !same(before.target, values.target)) cells.add(`${row.date}|target`)
    }
    // The week of a day is only needed by the detector, which reads it for the weekly comparison.
    const rowsAfter = [...after.values()].map((r) => ({ ...r, week: r.week || isoWeekOf(r.date) }))
    for (const flag of detectFlags(rowsAfter, [cultivation])) {
      if (flag.rule !== 'missing-value' && cells.has(`${flag.date}|${flag.field}`)) {
        found.push({ cultivation: flag.cultivation, kpi: flag.kpi, date: flag.date, explanation: flag.explanation })
      }
    }
  }
  return found
}

/** The rows to save for an import: every new and changed day, as imported rows. All of them share one time, so the edit log shows them together. */
export function toImportedRows(preview: ImportPreview, meta: { createdBy: string; createdAt: string }): EnteredRow[] {
  return [...preview.newRows, ...preview.changedRows].map(({ row, after }) => ({
    cultivation: row.cultivation,
    date: row.date,
    kpi: row.kpi,
    actual: after.actual,
    target: after.target,
    createdBy: meta.createdBy,
    createdAt: meta.createdAt,
    source: 'imported',
  }))
}
