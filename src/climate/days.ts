// The daily values of one cultivation, as the Climate tab reads them: the workspace laid over the workbook, with the data
// checks and the decisions applied (see src/scoring/effective.ts), so a flagged value that nobody has decided on is already left out.

import { addDays, formatDate, weekdayName, weekdayOf } from '../data/dates'
import { markOf, type CellState, type EffectiveRow, type FlagMark } from '../scoring/effective'

export interface DayCell {
  date: string
  actual: number | null
  target: number | null
  actualState: CellState
  targetState: CellState
}

/** KPI name, then date, then that day's cell. */
export type DayTable = Map<string, Map<string, DayCell>>

/** The days of one cultivation, by KPI and date. */
export function dayTable(rows: readonly EffectiveRow[], cultivation: string): DayTable {
  const table: DayTable = new Map()
  for (const row of rows) {
    if (row.cultivation !== cultivation) continue
    let days = table.get(row.kpi)
    if (!days) table.set(row.kpi, (days = new Map()))
    days.set(row.date, { date: row.date, actual: row.actual, target: row.target, actualState: row.actualState, targetState: row.targetState })
  }
  return table
}

/** Every date from `start` to `end`, both included. */
export function daysBetween(start: string, end: string): string[] {
  const days: string[] = []
  for (let day = start; day <= end && days.length < 4000; day = addDays(day, 1)) days.push(day)
  return days
}

/** The first and last date that any KPI has a row for; null when the cultivation has no days. */
export function periodOf(table: DayTable): { start: string; end: string } | null {
  let start: string | null = null
  let end: string | null = null
  for (const days of table.values()) {
    for (const date of days.keys()) {
      if (start === null || date < start) start = date
      if (end === null || date > end) end = date
    }
  }
  return start && end ? { start, end } : null
}

/** "Mon 18" on a week view, "18 Aug" on a longer one. */
export function dayLabel(date: string, weekday: boolean): string {
  const [, , d] = date.split('-').map(Number)
  if (weekday) return `${weekdayName(weekdayOf(date)).slice(0, 3)} ${d}`
  return formatDate(date).split(' ').slice(0, 2).join(' ')
}

/** One day of one KPI for a chart: the value in use, its target, and whether a flagged value sits behind it. */
export interface DayPoint {
  date: string
  label: string
  actual: number | null
  target: number | null
  actualMark: FlagMark
  targetMark: FlagMark
  openFlags: number
  decidedFlags: number
}

const STATE_FLAGGED = (s: CellState) => s === 'open'
const STATE_DECIDED = (s: CellState) => s === 'confirmed' || s === 'corrected' || s === 'excluded'

export function pointOf(cell: DayCell | undefined, date: string, weekday: boolean): DayPoint {
  const states = cell ? [cell.actualState, cell.targetState] : []
  return {
    date,
    label: dayLabel(date, weekday),
    actual: cell?.actual ?? null,
    target: cell?.target ?? null,
    actualMark: cell ? markOf([cell.actualState]) : null,
    targetMark: cell ? markOf([cell.targetState]) : null,
    openFlags: states.filter(STATE_FLAGGED).length,
    decidedFlags: states.filter(STATE_DECIDED).length,
  }
}

/** One KPI over a list of days; a day with no row is an empty point so the chart keeps its gap. */
export function kpiSeries(table: DayTable, kpi: string, dates: readonly string[], weekday: boolean): DayPoint[] {
  const days = table.get(kpi)
  return dates.map((date) => pointOf(days?.get(date), date, weekday))
}
