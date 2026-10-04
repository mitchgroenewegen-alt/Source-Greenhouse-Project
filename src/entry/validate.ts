// What is wrong with a typed date or number, in plain words. Pure, like the Setup checks.

import { addDays, formatDate } from '../data/dates'
import type { Cultivation } from '../data/types'
import { isIsoDate } from '../setup/validate'

/** "12,5" and "12.5" both work; anything else, and nothing, is not a number (NaN). */
export const toNumber = (text: string): number => (text.trim() === '' ? NaN : Number(text.trim().replace(',', '.')))

/** A day typed for a cultivation must be a real date, not before planting, and within three years of it (a guard against 2205 for 2025). */
const MAX_DAYS_AFTER_PLANTING = 3 * 366

export function dateProblem(date: string, cultivation: Pick<Cultivation, 'id' | 'plantingDate'>): string | undefined {
  if (date.trim() === '') return 'Pick a date.'
  if (!isIsoDate(date)) return 'Type the date as a day, for example 2025-08-25.'
  if (date < cultivation.plantingDate) return `${cultivation.id} was planted on ${formatDate(cultivation.plantingDate)}. Pick a day after that.`
  if (date > addDays(cultivation.plantingDate, MAX_DAYS_AFTER_PLANTING)) return 'That is more than three years after planting. Check the year.'
  return undefined
}

/** The error for a field that must be a number when it is filled in; undefined when it is empty or fine. */
export function optionalNumberProblem(text: string): string | undefined {
  return text.trim() === '' || Number.isFinite(toNumber(text)) ? undefined : 'Type a number, such as 12.5.'
}
