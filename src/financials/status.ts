import { scoreKpi, type Status } from '../scoring/score'

export type MoneyKind = 'revenue' | 'cost' | 'margin'

/**
 * The status of a money figure against its budget, on the scale of the KPI it follows: revenue and margin like Harvest (more is better,
 * green within 3 %, amber within 8 %), cost like Heating energy (less is better, green within 10 %, amber within 25 %).
 */
export function moneyStatus(kind: MoneyKind, line: { actual: number | null; budget: number | null }): Status | null {
  return scoreKpi(kind === 'cost' ? 'Heating energy (approx.)' : 'Harvest', line.actual, line.budget).status
}
