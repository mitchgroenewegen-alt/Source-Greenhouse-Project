export type RuleId =
  | 'unit-fahrenheit' // a Fahrenheit reading entered as Celsius
  | 'unit-fraction' // a fraction (0.4) entered where a percent (40) belongs
  | 'unit-factor-10' // a value that is 10x too big or too small
  | 'impossible-value' // humidity above 100, a negative amount, pH outside 4-9, ...
  | 'jump-vs-median' // far away from the cultivation's own typical value for this KPI
  | 'target-actual-apart' // target and actual more than 2.5x apart
  | 'missing-value' // nothing recorded

export type Severity = 'error' | 'warning' | 'info'

/** Which of the two columns the flagged value sits in. */
export type Field = 'actual' | 'target'

/** One suspect cell of the KPIs sheet. */
export interface Flag {
  /** Stable key of the cell: "PA-P2-TOV|Temperature (24h)|2025-07-01|target". */
  id: string
  cultivation: string
  kpi: string
  date: string
  field: Field
  /** The value as recorded; null when nothing was recorded. */
  value: number | null
  rule: RuleId
  severity: Severity
  /** Plain-English explanation for this cell. */
  explanation: string
  /** A corrected value to try, when the rule can work one out. */
  suggestion: number | null
}

/** Flags of the same cultivation, KPI, column and rule on consecutive dates, shown as one item. */
export interface FlagGroup {
  id: string
  cultivation: string
  kpi: string
  field: Field
  rule: RuleId
  severity: Severity
  startDate: string
  endDate: string
  flags: Flag[]
  /** One sentence for the whole group. */
  explanation: string
  /** How the suggestion is derived, e.g. "convert from Fahrenheit" or "multiply by 100"; null when there is none. */
  suggestionNote: string | null
}

export function cellId(cultivation: string, kpi: string, date: string, field: Field): string {
  return `${cultivation}|${kpi}|${date}|${field}`
}
