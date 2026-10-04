import { addDays, isoWeekOf, weekStartOf } from '../data/dates'

/** The ISO week `count` weeks after (or before, when negative) `weekId`: addWeeks('2025-W34', 1) is '2025-W35'. Works across years. */
export function addWeeks(weekId: string, count: number): string {
  return isoWeekOf(addDays(weekStartOf(weekId), count * 7))
}

/** Whole weeks from `earlier` to `later` (negative when `later` comes first). */
export function weeksBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${weekStartOf(later)}T00:00:00Z`) - Date.parse(`${weekStartOf(earlier)}T00:00:00Z`)) / (7 * 86_400_000))
}
