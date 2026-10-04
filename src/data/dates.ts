// Date helpers that work on ISO strings ("2025-08-24") in UTC, so no timezone can shift a day.

const DAY_MS = 86_400_000

/** Excel stores dates as a day count; serial 25569 is 1970-01-01. */
export function excelSerialToIso(serial: number): string {
  return new Date(Math.floor(serial - 25569) * DAY_MS).toISOString().slice(0, 10)
}

/** The other way round: the Excel day count of an ISO date, so an exported date is a real date in a spreadsheet. */
export function isoToExcelSerial(iso: string): number {
  return Math.round(toUtc(iso) / DAY_MS) + 25569
}

function toUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

export function diffDays(laterIso: string, earlierIso: string): number {
  return Math.round((toUtc(laterIso) - toUtc(earlierIso)) / DAY_MS)
}

/** ISO 8601 week id such as "2025-W34". */
export function isoWeekOf(iso: string): string {
  const t = new Date(toUtc(iso))
  const dayNum = (t.getUTCDay() + 6) % 7 // Monday = 0
  t.setUTCDate(t.getUTCDate() - dayNum + 3) // Thursday of this week decides the ISO year
  const isoYear = t.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * DAY_MS))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/** The Monday of an ISO week id such as "2025-W34" (week 1 is the week with 4 January in it). */
export function weekStartOf(weekId: string): string {
  const [year, week] = weekId.split('-W').map(Number)
  const jan4 = `${year}-01-04`
  return addDays(jan4, -weekdayOf(jan4) + (week! - 1) * 7)
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** 0 for Monday to 6 for Sunday. */
export function weekdayOf(iso: string): number {
  return (new Date(toUtc(iso)).getUTCDay() + 6) % 7
}

export const weekdayName = (weekday: number) => WEEKDAYS[weekday] ?? ''

/** Crop week counted from planting: the planting week is week 1. */
export function cropWeekOn(plantingIso: string, dateIso: string): number {
  return Math.floor(diffDays(dateIso, plantingIso) / 7) + 1
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "24 Aug 2025" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m! - 1]} ${y}`
}

/** "18-24 Aug 2025" (or "26 May-1 Jun 2025" across months). */
export function formatRange(startIso: string, endIso: string): string {
  const [y1, m1, d1] = startIso.split('-').map(Number)
  const [y2, m2, d2] = endIso.split('-').map(Number)
  if (y1 !== y2) return `${formatDate(startIso)} - ${formatDate(endIso)}`
  if (m1 === m2) return `${d1}-${d2} ${MONTHS[m2! - 1]} ${y2}`
  return `${d1} ${MONTHS[m1! - 1]} - ${d2} ${MONTHS[m2! - 1]} ${y2}`
}

/** "W34" from "2025-W34". */
export function shortWeek(weekId: string): string {
  return weekId.split('-')[1] ?? weekId
}
