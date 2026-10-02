import type { Aggregation } from './types'

export interface DatedPair {
  date: string
  actual: number | null
  target: number | null
}

export interface Rollup {
  actual: number | null
  target: number | null
  /** Days that went into the roll-up. */
  days: number
  /** True when actual and target come from the same days and can be compared. */
  paired: boolean
}

export function round(value: number, digits = 6): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** Apply a dictionary aggregation rule to values that are already in date order. */
export function aggregate(values: number[], rule: Aggregation): number | null {
  if (values.length === 0) return null
  switch (rule) {
    case 'sum':
      return round(values.reduce((a, b) => a + b, 0))
    case 'average':
      return round(values.reduce((a, b) => a + b, 0) / values.length)
    case 'last':
      return values[values.length - 1]!
  }
}

/**
 * Roll a run of days up to one number each for actual and target, using the same rule for both
 * and only the days that have both values. If no day has both, actual and target are rolled up
 * separately so the chart can still show what exists, but `paired` is false and nothing is scored.
 * Points must be in date order.
 */
export function rollup(points: DatedPair[], rule: Aggregation): Rollup {
  const both = points.filter((p) => p.actual !== null && p.target !== null)
  if (both.length > 0) {
    return {
      actual: aggregate(both.map((p) => p.actual as number), rule),
      target: aggregate(both.map((p) => p.target as number), rule),
      days: both.length,
      paired: true,
    }
  }
  const actuals = points.filter((p) => p.actual !== null).map((p) => p.actual as number)
  if (actuals.length > 0) {
    return { actual: aggregate(actuals, rule), target: null, days: actuals.length, paired: false }
  }
  const targets = points.filter((p) => p.target !== null).map((p) => p.target as number)
  return { actual: null, target: aggregate(targets, rule), days: targets.length, paired: false }
}
