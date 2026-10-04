// Before a new budget or target is saved, the same data checks that look at recorded values look at it, so a slipped
// unit (69 typed for 20.6 °C) is caught while it can still be fixed. Pure: no screens, nothing saved.

import { detectFlags, groupFlags, ruleTitleFor, type Flag, type RuleId } from '../flags'
import { isoWeekOf } from '../data/dates'
import type { Cultivation, DailyRow } from '../data/types'
import type { DayChange } from './plan'

export interface Concern {
  rule: RuleId
  /** "Fahrenheit entered as Celsius", "Target and actual far apart", ... */
  title: string
  /** The rule's plain explanation, with its suggestion when it has one. */
  explanation: string
  days: number
}

export interface PrecheckResult {
  concerns: Concern[]
  /** The changes with each day's suggested value in place of the typed one; null when no rule has a suggestion. */
  suggested: DayChange[] | null
}

/**
 * Runs the data checks on one cultivation's series of one KPI as it would be after the changes, and keeps what they
 * find on the changed days' targets. Missing values are left out: they are about actuals and there is nothing to confirm.
 * `series` is the KPI's rows (any cultivations are fine, only `cultivation` is looked at).
 */
export function precheckChanges(series: DailyRow[], cultivation: Cultivation, changes: DayChange[]): PrecheckResult {
  const after = new Map(changes.map((c) => [c.date, c.after]))
  const rows = series.filter((r) => r.cultivation === cultivation.id).map((r) => (after.has(r.date) ? { ...r, target: after.get(r.date)! } : r))
  const flags: Flag[] = detectFlags(rows, [cultivation]).filter((f) => f.field === 'target' && f.rule !== 'missing-value' && after.has(f.date))

  const concerns = groupFlags(flags, rows).map((g): Concern => ({
    rule: g.rule,
    title: ruleTitleFor(g.rule, g.kpi),
    explanation: g.explanation,
    days: g.flags.length,
  }))

  const suggestions = new Map(flags.filter((f) => f.suggestion !== null).map((f) => [f.date, f.suggestion as number]))
  const suggested = suggestions.size === 0 ? null : changes.map((c) => ({ ...c, after: suggestions.get(c.date) ?? c.after }))
  return { concerns, suggested }
}

/** A value typed for a day. One left out (undefined) is not being changed, so it is not checked. */
export interface ValueChange {
  date: string
  actual?: number
  target?: number
}

export interface ValuePrecheck {
  concerns: Concern[]
  /** The changes with each suggested value in place of the typed one; null when no rule has a suggestion. */
  suggested: ValueChange[] | null
}

const FIELDS = ['actual', 'target'] as const

/**
 * The same checks for typed actuals and targets (Enter data). `series` is the KPI's rows as they are now; a day that has
 * no row yet gets one. The checks look at the cultivation's own series, so a Fahrenheit reading is caught against the
 * Celsius readings already there. Like the detector, a day with no actual is not checked for its target.
 */
export function precheckValues(series: DailyRow[], cultivation: Cultivation, kpi: string, changes: ValueChange[]): ValuePrecheck {
  const byDate = new Map(changes.map((c) => [c.date, c]))
  const rows = series.filter((r) => r.cultivation === cultivation.id && r.kpi === kpi).map((r) => {
    const change = byDate.get(r.date)
    return change ? { ...r, actual: change.actual ?? r.actual, target: change.target ?? r.target } : r
  })
  const have = new Set(rows.map((r) => r.date))
  for (const c of changes) {
    if (!have.has(c.date)) rows.push({ date: c.date, week: isoWeekOf(c.date), cultivation: cultivation.id, kpi, actual: c.actual ?? null, target: c.target ?? null })
  }

  const typed = new Set(changes.flatMap((c) => FIELDS.filter((f) => c[f] !== undefined).map((f) => `${c.date}|${f}`)))
  const flags: Flag[] = detectFlags(rows, [cultivation]).filter((f) => f.rule !== 'missing-value' && typed.has(`${f.date}|${f.field}`))

  const concerns = groupFlags(flags, rows).map((g): Concern => ({
    rule: g.rule,
    title: ruleTitleFor(g.rule, g.kpi),
    explanation: g.explanation,
    days: g.flags.length,
  }))

  const suggestions = new Map(flags.filter((f) => f.suggestion !== null).map((f) => [`${f.date}|${f.field}`, f.suggestion as number]))
  const suggested =
    suggestions.size === 0
      ? null
      : changes.map((c) => ({
          date: c.date,
          ...(c.actual !== undefined && { actual: suggestions.get(`${c.date}|actual`) ?? c.actual }),
          ...(c.target !== undefined && { target: suggestions.get(`${c.date}|target`) ?? c.target }),
        }))
  return { concerns, suggested }
}
