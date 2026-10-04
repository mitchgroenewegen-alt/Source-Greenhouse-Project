// Editing a budget or target: turns "this week should be 12.5" into the daily values the data really holds, and those
// into value edits. Pure functions, no screens. The workbook is never touched; an edit is laid over it by merge.
//
// A weekly number is a roll-up of days (see src/data/aggregate.ts), so a new weekly value has to be translated back:
//   sum            spread over the days of that week that have a row, in proportion to the daily targets they have now
//                  (evenly when there are none), so the week adds up to the number typed.
//   average, last  every day of the week gets the number, so the week rolls up to it.
// Only days that already have a row are changed. A day with no row is never made up.

import { aggregate, round } from '../data/aggregate'
import { addDays } from '../data/dates'
import type { Aggregation, DailyRow } from '../data/types'
import type { ValueEdit } from '../workspace/types'

/** One day in the weeks being edited, with the target it has now and the one it gets. */
export interface DayChange {
  date: string
  week: string
  /** The target the day has now; null when it has none. */
  before: number | null
  after: number
}

/** One week as the person sees it: the weekly number before and after. */
export interface WeekPreview {
  week: string
  before: number | null
  after: number | null
}

export type EditRequest =
  | { mode: 'week'; week: string; value: number }
  /** `endDate`: the planned end of the cultivation; when there is none, the last day with data. */
  | { mode: 'from'; week: string; value: number; endDate: string | null }
  | { mode: 'scale'; fromWeek: string; toWeek: string; percent: number }

export interface EditPlan {
  changes: DayChange[]
  weeks: WeekPreview[]
  /** Mode "from a week onward" with an average or last-value KPI: the day the new value is meant to reach (see toValueEdits). */
  rangeEnd: string | null
}

/** The rows of one cultivation and KPI, oldest first. */
export function seriesOf(daily: DailyRow[], cultivation: string, kpi: string): DailyRow[] {
  return daily.filter((r) => r.cultivation === cultivation && r.kpi === kpi).sort((a, b) => a.date.localeCompare(b.date))
}

/** The last day any KPI of the cultivation has a row. */
export function lastDataDate(daily: DailyRow[], cultivation: string): string | null {
  let last: string | null = null
  for (const r of daily) if (r.cultivation === cultivation && (last === null || r.date > last)) last = r.date
  return last
}

const round4 = (value: number) => Math.round(value * 1e4) / 1e4

/** The new daily targets for the days of one week. */
export function translateWeek(rule: Aggregation, days: { date: string; target: number | null }[], value: number): { date: string; after: number }[] {
  if (days.length === 0) return []
  if (rule !== 'sum') return days.map((d) => ({ date: d.date, after: value }))
  const withTarget = days.filter((d) => d.target !== null)
  const total = withTarget.reduce((sum, d) => sum + (d.target as number), 0)
  // Proportional to what the days have now; evenly when there is nothing to go by.
  const shares = total > 0 ? withTarget.map((d) => ({ date: d.date, share: (d.target as number) / total })) : days.map((d) => ({ date: d.date, share: 1 / days.length }))
  const out = shares.map((s) => ({ date: s.date, after: round4(value * s.share) }))
  // The last day takes the rounding leftover, so the week adds up to exactly the number typed.
  const last = out.length - 1
  out[last]!.after = round(value - out.slice(0, last).reduce((sum, d) => sum + d.after, 0))
  return out
}

function groupByWeek(rows: DailyRow[]): Map<string, DailyRow[]> {
  const weeks = new Map<string, DailyRow[]>()
  for (const r of rows) {
    const list = weeks.get(r.week)
    if (list) list.push(r)
    else weeks.set(r.week, [r])
  }
  return weeks
}

/** The daily changes and the weekly before and after for a request. `series` is one cultivation's rows of one KPI. */
export function planEdit(series: DailyRow[], rule: Aggregation, request: EditRequest, lastDate: string | null): EditPlan {
  let rows: DailyRow[]
  let rangeEnd: string | null = null
  switch (request.mode) {
    case 'week':
      rows = series.filter((r) => r.week === request.week)
      break
    case 'from': {
      const end = request.endDate ?? lastDate
      rows = series.filter((r) => r.week >= request.week && (end === null || r.date <= end))
      // A sum is spread over the days that exist, so it cannot reach days that have no row yet.
      rangeEnd = rule === 'sum' ? null : end
      break
    }
    case 'scale':
      rows = series.filter((r) => r.week >= request.fromWeek && r.week <= request.toWeek)
      break
  }

  const changes: DayChange[] = []
  const weeks: WeekPreview[] = []
  for (const [week, days] of groupByWeek(rows)) {
    let after: { date: string; after: number }[]
    if (request.mode === 'scale') {
      after = days.filter((d) => d.target !== null).map((d) => ({ date: d.date, after: round((d.target as number) * (1 + request.percent / 100)) }))
    } else {
      after = translateWeek(rule, days.map((d) => ({ date: d.date, target: d.target })), request.value)
    }
    const afterByDate = new Map(after.map((a) => [a.date, a.after]))
    const present = (values: (number | null)[]) => values.filter((v): v is number => v !== null)
    weeks.push({
      week,
      before: aggregate(present(days.map((d) => d.target)), rule),
      after: aggregate(present(days.map((d) => afterByDate.get(d.date) ?? d.target)), rule),
    })
    for (const d of days) {
      const next = afterByDate.get(d.date)
      if (next !== undefined) changes.push({ date: d.date, week, before: d.target, after: next })
    }
  }
  return { changes, weeks, rangeEnd }
}

/** True when saving would change nothing: every day already has the new value. */
export const changesNothing = (plan: EditPlan) => plan.changes.every((c) => c.before === c.after)

/** What is wrong with a request, in plain words; null when it is fine. */
export function requestProblem(request: EditRequest | null, hasRows: boolean): string | null {
  if (!request) return 'Choose the weeks and type a value.'
  if (!hasRows) return 'There are no days to change in these weeks.'
  if (request.mode === 'scale') {
    if (!Number.isFinite(request.percent) || request.percent === 0) return 'Type a percentage other than 0, such as 10 or -5.'
    if (request.percent <= -100) return 'A change of -100 % or more would empty the weeks. Type a smaller percentage.'
    if (request.fromWeek > request.toWeek) return 'The first week must not be after the last week.'
    return null
  }
  if (!Number.isFinite(request.value)) return 'Type the new value as a number.'
  return null
}

/**
 * Value edits for the changes: one per run of consecutive days that get the same new value from the same old value,
 * so "every day of W34 to W40 is 21" is one edit. In mode "from a week onward" the last run reaches the end date, which
 * is how the new value applies to days that are entered later; days with no row are never created.
 */
export function toValueEdits(
  changes: DayChange[],
  meta: { cultivation: string; kpi: string; createdBy: string; createdAt: string; reason: string; rangeEnd?: string | null },
): ValueEdit[] {
  const sorted = [...changes].sort((a, b) => a.date.localeCompare(b.date))
  const runs: DayChange[][] = []
  for (const change of sorted) {
    const run = runs[runs.length - 1]
    const prev = run?.[run.length - 1]
    if (run && prev && addDays(prev.date, 1) === change.date && prev.after === change.after && prev.before === change.before) run.push(change)
    else runs.push([change])
  }
  const edits = runs.map((run): ValueEdit => ({
    id: `edit|${meta.createdAt}|${meta.cultivation}|${meta.kpi}|${run[0]!.date}`,
    cultivation: meta.cultivation,
    kpi: meta.kpi,
    dateFrom: run[0]!.date,
    dateTo: run[run.length - 1]!.date,
    field: 'target',
    newValue: run[0]!.after,
    originalValue: run[0]!.before,
    createdBy: meta.createdBy,
    createdAt: meta.createdAt,
    reason: meta.reason.trim() || 'Edited',
    source: 'edited',
  }))
  const last = edits[edits.length - 1]
  if (last && meta.rangeEnd && meta.rangeEnd > last.dateTo) last.dateTo = meta.rangeEnd
  return edits
}
