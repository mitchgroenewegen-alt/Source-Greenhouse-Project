// The weekly crop registration: which day of the week a value is saved on.
//
// The workbook records the Plant KPIs once a week, always on the Monday, and Waste on the Sunday (the last day of the
// week). A weekly value has to land on the same weekday as the ones before it, or the week would hold two values for
// one registration. The rule:
//   1. Look at the days this KPI has recorded values on for this cultivation. When at least 80 % of them fall on one
//      weekday, that is the weekday the KPI is registered on, and the new value is saved on it.
//   2. A cultivation with no values yet (a new one) follows the other cultivations in the same way.
//   3. Otherwise (no values anywhere, or a KPI that is recorded on every day) the value is saved on the Monday.

import { addDays, isoWeekOf, weekdayOf, weekStartOf } from '../data/dates'
import type { DailyRow, WeekInfo } from '../data/types'

const MONDAY = 0
/** The share of recorded values that must fall on one weekday for it to count as "the" registration day. */
const DOMINANT_SHARE = 0.8

function dominantWeekday(rows: DailyRow[]): number | null {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  let total = 0
  for (const row of rows) {
    if (row.actual === null) continue
    counts[weekdayOf(row.date)]!++
    total++
  }
  if (total === 0) return null
  const top = counts.indexOf(Math.max(...counts))
  return counts[top]! / total >= DOMINANT_SHARE ? top : MONDAY
}

/** The weekday (Monday = 0) a KPI of a cultivation is registered on; see the rule above. */
export function registrationWeekday(daily: DailyRow[], cultivation: string, kpi: string): number {
  const ofKpi = daily.filter((r) => r.kpi === kpi)
  const own = dominantWeekday(ofKpi.filter((r) => r.cultivation === cultivation))
  return own ?? dominantWeekday(ofKpi) ?? MONDAY
}

/** The date a weekly value is saved on: that weekday of the ISO week. */
export function registrationDate(week: string, weekday: number): string {
  return addDays(weekStartOf(week), weekday)
}

/** The weeks that can be picked: every week in the data, then this many more, so the next week can be registered. */
export const WEEKS_AHEAD = 8

export function weekChoices(weeks: WeekInfo[]): WeekInfo[] {
  const last = weeks[weeks.length - 1]
  if (!last) return []
  const ahead = Array.from({ length: WEEKS_AHEAD }, (_, i): WeekInfo => {
    const start = addDays(last.start, 7 * (i + 1))
    return { id: isoWeekOf(start), start, end: addDays(start, 6) }
  })
  return [...weeks, ...ahead]
}

/** The ISO week before this one. */
export const previousWeek = (week: string) => isoWeekOf(addDays(weekStartOf(week), -7))
