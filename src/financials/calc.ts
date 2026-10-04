// The money of one cultivation: revenue, value lost to waste, energy and water cost, partial margin, and the gap to budget.
//
// Formulas (area = growing area in m², all weekly figures; a budget is worked out the same way from the budget values):
//   revenue      = harvest (kg/m²) x area x price per kg. Harvest is already net of waste, so waste is not subtracted again.
//   waste value  = harvest x w / (1 - w) x area x price, with w the Waste % as a fraction. If 3 % of what was picked is waste, the
//                  net harvest is 97 % of it, and the waste is 3/97 of the net harvest.
//   heat cost    = heating (kWh/m²) x area x heat price per kWh
//   LED cost     = LED hours x installed LED power (W/m²) / 1000 x area x electricity price per kWh
//   water cost   = irrigation water (L/m²) / 1000 x area x water price per m³
//   margin       = revenue - heat - LED - water. A partial margin: labour, plants and packaging are not in the data.
// A figure needs both of its inputs; a missing one makes it missing (never zero). A comparison with budget only uses weeks where
// the actual and the budget are both known (the app's "paired" rule), so both sides cover the same weeks.

import type { Range } from '../forecast'
import { FINANCIAL_KPI } from './defaults'
import type { Costs, CultivationForecastMoney, Effects, Line, Period } from './types'

/** A weekly KPI value as the scores have it: only the fields used here. */
export type WeeklyValue = { actual: number | null; target: number | null; paired: boolean } | undefined
export type ValueOf = (kpi: string, week: string) => WeeklyValue

export interface MoneyInputs {
  areaM2: number
  /** Installed LED power, W/m². */
  ledWattsPerM2: number
  /** Money per kg; null when there is no price. */
  price: number | null
  heatPerKwh: number
  electricityPerKwh: number
  waterPerM3: number
}

const times = (...factors: (number | null)[]): number | null => (factors.some((f) => f === null) ? null : factors.reduce<number>((a, b) => a * b!, 1))

/** The lost share of what was picked: harvest x w / (1 - w). `percent` is the Waste KPI (a percentage); null when it is not a usable share. */
export function wasteKgPerM2(harvestKgPerM2: number | null, wastePercent: number | null): number | null {
  if (harvestKgPerM2 === null || wastePercent === null) return null
  const w = wastePercent / 100
  if (!(w >= 0 && w < 1)) return null
  return (harvestKgPerM2 * w) / (1 - w)
}

/** What one week's values give, before the weeks are added up. `actual` and `budget` are each null when an input is missing. */
export interface WeekLines {
  revenue: Line
  wasteValue: Line
  heat: Line
  led: Line
  water: Line
}

export function weekLines(inputs: MoneyInputs, valueOf: ValueOf, week: string): WeekLines {
  const v = (kpi: string) => valueOf(kpi, week)
  const harvest = v(FINANCIAL_KPI.harvest)
  const waste = v(FINANCIAL_KPI.waste)
  const heating = v(FINANCIAL_KPI.heating)
  const led = v(FINANCIAL_KPI.led)
  const water = v(FINANCIAL_KPI.water)
  const { areaM2: a, price } = inputs

  // A budget exists only where it is paired with an actual (same days), so a comparison is like for like.
  const actual = (p: WeeklyValue) => (p ? p.actual : null)
  const budget = (p: WeeklyValue) => (p && p.paired ? p.target : null)
  const harvestBudget = harvest && harvest.paired ? harvest.target : null
  const wasteBudget = waste && waste.paired ? waste.target : null

  const ledCost = (hours: number | null) => times(hours, inputs.ledWattsPerM2 / 1000, a, inputs.electricityPerKwh)
  return {
    revenue: { actual: times(actual(harvest), a, price), budget: times(harvestBudget, a, price) },
    wasteValue: { actual: times(wasteKgPerM2(actual(harvest), actual(waste)), a, price), budget: times(wasteKgPerM2(harvestBudget, wasteBudget), a, price) },
    heat: { actual: times(actual(heating), a, inputs.heatPerKwh), budget: times(budget(heating), a, inputs.heatPerKwh) },
    led: { actual: ledCost(actual(led)), budget: ledCost(budget(led)) },
    // Irrigation water has no target in the workbook, so its budget stays empty until one is entered.
    water: { actual: times(actual(water) === null ? null : actual(water)! / 1000, a, inputs.waterPerM3), budget: times(budget(water) === null ? null : budget(water)! / 1000, a, inputs.waterPerM3) },
  }
}

const add = (values: (number | null)[]): number | null => {
  const present = values.filter((x): x is number => x !== null)
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0)
}

/**
 * Adds up lines (weeks of one cultivation, or cultivations of a facility). Where any of them has both an actual and a budget,
 * only those count, so the two sides cover the same ground. Where none has, the actual alone is added and the budget stays empty.
 */
export function sumLines(lines: Line[]): Line {
  const both = lines.filter((l) => l.actual !== null && l.budget !== null)
  if (both.length > 0) return { actual: add(both.map((l) => l.actual)), budget: add(both.map((l) => l.budget)) }
  return { actual: add(lines.map((l) => l.actual)), budget: null }
}

const hasAny = (line: Line) => line.actual !== null || line.budget !== null

/** Costs and margin from the added-up lines of a period (a week, or all weeks to date). */
export function periodFrom(weeks: WeekLines[]): Period {
  const revenue = sumLines(weeks.map((w) => w.revenue))
  const wasteValue = sumLines(weeks.map((w) => w.wasteValue))
  const heat = sumLines(weeks.map((w) => w.heat))
  const led = sumLines(weeks.map((w) => w.led))
  const water = sumLines(weeks.map((w) => w.water))
  return {
    weeks: weeks.filter((w) => hasAny(w.revenue) || hasAny(w.heat) || hasAny(w.led) || hasAny(w.water)).length,
    revenue,
    wasteValue,
    heat,
    led,
    water,
    ...costsAndMargin(revenue, [heat, led, water]),
  }
}

/** Total cost, the partial margin and the gap to budget, from the revenue and the cost components. */
export function costsAndMargin(revenue: Line, components: Line[]): Pick<Period, 'costs' | 'margin' | 'effects'> {
  const compared = components.filter((c) => c.budget !== null)
  const costs: Costs = {
    actual: add(components.map((c) => c.actual)),
    budget: add(compared.map((c) => c.budget)),
    actualCompared: add(compared.map((c) => c.actual)),
    uncompared: add(components.filter((c) => c.budget === null).map((c) => c.actual)) ?? 0,
  }
  const margin: Line = {
    actual: revenue.actual === null ? null : revenue.actual - (costs.actual ?? 0),
    budget: revenue.budget === null || costs.budget === null ? null : revenue.budget - costs.budget,
  }
  return { costs, margin, effects: effectsOf(revenue, costs) }
}

/**
 * The gap in the partial margin against budget, like for like (costs with no budget, such as irrigation water, are left out of both
 * sides), split in two: the volume effect (revenue actual minus revenue budget, which is all kg since the price is the same) and the
 * cost effect (budgeted energy cost minus actual energy cost). Volume + cost = gap exactly.
 */
export function effectsOf(revenue: Line, costs: Pick<Costs, 'budget' | 'actualCompared'>): Effects | null {
  if (revenue.actual === null || revenue.budget === null || costs.budget === null || costs.actualCompared === null) return null
  const volume = revenue.actual - revenue.budget
  const cost = costs.budget - costs.actualCompared
  return { volume, cost, gap: volume + cost }
}

/** Revenue (money) from a range in kg/m²: x area x price. */
export function revenueRange(kgPerM2: Range, areaM2: number, price: number): Range {
  return { low: kgPerM2.low * areaM2 * price, expected: kgPerM2.expected * areaM2 * price, high: kgPerM2.high * areaM2 * price }
}

export function addRanges(ranges: Range[]): Range {
  return ranges.reduce((s, r) => ({ low: s.low + r.low, expected: s.expected + r.expected, high: s.high + r.high }), { low: 0, expected: 0, high: 0 })
}

/** Forecast revenue of a cultivation: the forecast weeks, and the weeks after them up to the season end when the forecast has one. */
export function forecastMoney(
  forecast: { weeks: { week: string }[]; total: Range; toDate: number | null; seasonEnd: { expected: number; low: number; high: number } | null },
  areaM2: number,
  price: number | null,
): CultivationForecastMoney | null {
  if (price === null || forecast.weeks.length === 0) return null
  const toSeasonEnd =
    forecast.seasonEnd && forecast.toDate !== null
      ? revenueRange({ low: forecast.seasonEnd.low - forecast.toDate, expected: forecast.seasonEnd.expected - forecast.toDate, high: forecast.seasonEnd.high - forecast.toDate }, areaM2, price)
      : null
  return {
    fromWeek: forecast.weeks[0]!.week,
    toWeek: forecast.weeks[forecast.weeks.length - 1]!.week,
    revenue: revenueRange(forecast.total, areaM2, price),
    toSeasonEnd,
  }
}
