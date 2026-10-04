// What a cultivation has to show: a budget (targets) and recorded values (actuals). A cultivation set up in the app starts
// with neither, and the screens say so instead of showing a row of "Not scored".

import type { DailyRow, WeekInfo } from '../data/types'

/**
 * ready: has targets and actuals, so it is scored as usual.
 * no-budget: no targets at all yet (a new cultivation, until budgets are copied or entered), whatever else it has.
 * no-data: has targets but nothing has been recorded yet.
 */
export type DataState = 'ready' | 'no-budget' | 'no-data'

export const DATA_STATE_LABEL: Record<Exclude<DataState, 'ready'>, string> = {
  'no-budget': 'No budget yet',
  'no-data': 'No data yet',
}

export function dataStates(daily: DailyRow[]): ReadonlyMap<string, { hasTarget: boolean; hasActual: boolean }> {
  const seen = new Map<string, { hasTarget: boolean; hasActual: boolean }>()
  for (const row of daily) {
    const entry = seen.get(row.cultivation) ?? { hasTarget: false, hasActual: false }
    if (row.target !== null) entry.hasTarget = true
    if (row.actual !== null) entry.hasActual = true
    seen.set(row.cultivation, entry)
  }
  return seen
}

export function dataStateOf(seen: ReturnType<typeof dataStates>, cultivation: string): DataState {
  const entry = seen.get(cultivation)
  if (!entry || !entry.hasTarget) return 'no-budget'
  return entry.hasActual ? 'ready' : 'no-data'
}

/** The latest week in which anything was recorded; the app opens on it, so a budget copied into the future does not hide the real weeks. */
export function latestWeekWithActuals(daily: DailyRow[], weeks: WeekInfo[]): string | undefined {
  const withActual = new Set(daily.filter((r) => r.actual !== null).map((r) => r.week))
  return [...weeks].reverse().find((w) => withActual.has(w.id))?.id
}
