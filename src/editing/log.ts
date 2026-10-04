// The edit log: every value edit, newest first, with the ones made in one go (a copy of budgets, a week spread over
// several days) read as one line. Pure functions, no screens.

import { aggregate } from '../data/aggregate'
import { addDays, isoWeekOf, shortWeek } from '../data/dates'
import type { Aggregation } from '../data/types'
import type { ValueEdit } from '../workspace/types'
import { isCopyEdit } from './original'
import { cellIdOfCorrection } from '../workspace/corrections'

export interface LogEntry {
  /** Stable: the same entry keeps its key while it is in the log. */
  key: string
  edits: ValueEdit[]
  cultivation: string
  /** null for budgets copied from another cultivation, which cover every KPI. */
  kpi: string | null
  createdBy: string
  createdAt: string
  reason: string
  source: ValueEdit['source']
  field: ValueEdit['field']
  dateFrom: string
  dateTo: string
}

/** Edits that share cultivation, KPI, column, source, person, time and reason are one entry; a copy of budgets ignores the KPI. */
export function groupEdits(edits: ValueEdit[]): LogEntry[] {
  const groups = new Map<string, ValueEdit[]>()
  for (const e of edits) {
    const key = [e.cultivation, e.source, e.createdBy, e.createdAt, e.reason, isCopyEdit(e) ? 'copy' : `${e.kpi}|${e.field}`].join('|')
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }
  return [...groups.entries()]
    .map(([key, list]): LogEntry => {
      const first = list[0]!
      return {
        key,
        edits: [...list].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)),
        cultivation: first.cultivation,
        kpi: isCopyEdit(first) ? null : first.kpi,
        createdBy: first.createdBy,
        createdAt: first.createdAt,
        reason: first.reason,
        source: first.source,
        field: first.field,
        dateFrom: list.reduce((min, e) => (e.dateFrom < min ? e.dateFrom : min), first.dateFrom),
        dateTo: list.reduce((max, e) => (e.dateTo > max ? e.dateTo : max), first.dateTo),
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.key.localeCompare(b.key))
}

/** "W34" or "W34 to W40". */
export function weeksText(entry: Pick<LogEntry, 'dateFrom' | 'dateTo'>): string {
  const from = shortWeek(isoWeekOf(entry.dateFrom))
  const to = shortWeek(isoWeekOf(entry.dateTo))
  return from === to ? from : `${from} to ${to}`
}

/** The decisions an undo of this entry has to reopen: the cells of "Apply correction" edits. Empty for any other source. */
export function correctedCells(entry: LogEntry): string[] {
  return entry.source === 'corrected' ? entry.edits.map((e) => cellIdOfCorrection(e.id)) : []
}

export interface WeekChange {
  week: string
  /** null: the days had no value before. */
  before: number | null
  after: number
}

/**
 * The entry as weekly numbers: for each week it touches, the weekly value before and after, rolled up with the KPI's rule
 * over the days that have a row (`hasRow`), so it reads like the weekly table does. null for an entry without a single KPI.
 */
export function weeklyChanges(entry: LogEntry, rule: Aggregation, hasRow: (date: string) => boolean): WeekChange[] | null {
  if (entry.kpi === null) return null
  const days = new Map<string, { date: string; before: number | null; after: number }[]>()
  for (const e of entry.edits) {
    for (let date = e.dateFrom, i = 0; date <= e.dateTo && i < 3660; i++, date = addDays(date, 1)) {
      if (!hasRow(date)) continue
      const week = isoWeekOf(date)
      const list = days.get(week) ?? []
      list.push({ date, before: e.originalValue, after: e.newValue })
      days.set(week, list)
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, list]) => {
      list.sort((a, b) => a.date.localeCompare(b.date))
      const known = list.every((d) => d.before !== null)
      return {
        week,
        before: known ? aggregate(list.map((d) => d.before as number), rule) : null,
        after: aggregate(list.map((d) => d.after), rule)!,
      }
    })
}
