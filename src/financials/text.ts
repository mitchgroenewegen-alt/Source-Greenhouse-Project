// Money as text, and the text typed into the Prices and costs form.

import { fixed } from '../lib/format'
import type { Errors } from '../setup/validate'
import type { PriceSourceNote, Rates } from '../workspace/types'

/** "554,976 USD", or "–" when there is no figure. */
export const moneyText = (value: number | null, currency: string): string => (value === null ? '–' : `${fixed(value, 0)} ${currency}`)

/** "+1,200 USD" / "-300 USD" (a real minus sign), "0 USD". */
export function signedMoney(value: number, currency: string): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${fixed(Math.abs(rounded), 0)} ${currency}`
}

export interface RatesInput {
  heatPerKwh: string
  electricityPerKwh: string
  waterPerM3: string
  /** Price per kg for the facility by fruit type id; empty text means "use the fruit type's price". */
  prices: Record<string, string>
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

/** What the form starts from. */
export function rateInputsOf(rates: Rates | undefined): RatesInput {
  return {
    heatPerKwh: text(rates?.heatPerKwh),
    electricityPerKwh: text(rates?.electricityPerKwh),
    waterPerM3: text(rates?.waterPerM3),
    prices: Object.fromEntries(Object.entries(rates?.priceOverrides ?? {}).map(([id, v]) => [id, String(v)])),
  }
}

const parse = (value: string) => (value.trim() === '' ? null : Number(value))
const bad = (n: number | null) => n !== null && (!Number.isFinite(n) || n < 0)

/** One message for a number that must be 0 or more or empty; undefined when fine. */
export function validateRateText(value: string): string | undefined {
  return bad(parse(value)) ? 'Enter a number of 0 or more, or leave it empty.' : undefined
}

/** Errors by field name: heatPerKwh, electricityPerKwh, waterPerM3 and `price:<fruit type id>`. */
export function validateRates(input: RatesInput): Errors {
  const errors: Errors = {}
  for (const field of ['heatPerKwh', 'electricityPerKwh', 'waterPerM3'] as const) {
    const problem = validateRateText(input[field])
    if (problem) errors[field] = problem
  }
  for (const [id, value] of Object.entries(input.prices)) {
    const problem = validateRateText(value)
    if (problem) errors[`price:${id}`] = problem
  }
  return errors
}

/** The market price notes that still hold: a price typed over (or removed) no longer comes from the file, so its note goes. */
function keptSources(overrides: Record<string, number>, previous: Rates | undefined): Record<string, PriceSourceNote> | null {
  const kept = Object.fromEntries(Object.entries(previous?.priceSources ?? {}).filter(([id]) => overrides[id] !== undefined && overrides[id] === previous?.priceOverrides?.[id]))
  return Object.keys(kept).length > 0 ? kept : null
}

/** The row to save for a facility (call it only when validateRates found nothing wrong). Empty prices are not overrides. */
export function ratesRowFor(facilityId: string, input: RatesInput, who: string, now: Date, previous?: Rates): Rates {
  const overrides = Object.fromEntries(Object.entries(input.prices).flatMap(([id, value]) => (parse(value) === null ? [] : [[id, Number(value)] as const])))
  const sources = keptSources(overrides, previous)
  return {
    facilityId,
    heatPerKwh: parse(input.heatPerKwh),
    electricityPerKwh: parse(input.electricityPerKwh),
    waterPerM3: parse(input.waterPerM3),
    priceOverrides: Object.keys(overrides).length > 0 ? overrides : null,
    ...(sources ? { priceSources: sources } : {}),
    updatedBy: who || null,
    updatedAt: now.toISOString(),
  }
}

/** "555k", "1.2M" or "840": for tables where full figures do not fit. */
export function compactMoney(value: number | null): string {
  if (value === null) return '–'
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}${fixed(abs / 1_000_000, abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000) return `${sign}${fixed(abs / 1_000, 0)}k`
  return `${sign}${fixed(abs, 0)}`
}

/** The actual compared with the budget, in percent of the budget; null when there is no budget or it is 0. */
export function variancePercent(line: { actual: number | null; budget: number | null }): number | null {
  if (line.actual === null || line.budget === null || line.budget === 0) return null
  return ((line.actual - line.budget) / Math.abs(line.budget)) * 100
}
