// Before a new budget or target is saved, the same data checks that look at recorded values look at it, so a slipped
// unit (69 typed for 20.6 °C) is caught while it can still be fixed. Pure: no screens, nothing saved.

import { detectFlags, groupFlags, ruleTitleFor, type Flag, type RuleId } from '../flags'
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
