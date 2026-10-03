// The maths behind the semicircular meter on a Scorecard tile. No drawing here, so it can be tested on its own.
//
// The scale runs from 0 to `rangeOfBudget` x the week's budget (the budget is the maximum allowed), so with the
// Waste setting of 1.2 a 4.0 % budget gives a 0 to 4.8 % meter and the budget tick sits 1/1.2 of the way round.

export interface GaugeModel {
  /** The week's budget, the maximum allowed. */
  budget: number
  /** The week's actual, as recorded. */
  actual: number
  /** The end of the scale: rangeOfBudget x budget. */
  scaleMax: number
  /** The actual held to the scale, so the number stays inside the meter's range. */
  clampedActual: number
  /** How much of the arc is filled, 0 to 1. Full (1) when the actual reaches or passes the end of the scale. */
  fraction: number
  /** Where the budget tick sits on the arc, 0 to 1: always 1 / rangeOfBudget. */
  budgetFraction: number
  /** The actual is beyond the end of the scale, which the meter shows with its own marker and text. */
  over: boolean
}

const finite = (n: number | null): n is number => n !== null && Number.isFinite(n)

const roundTo = (value: number, decimals: number) => Number(value.toFixed(decimals))

/**
 * The model for one meter, or null when there is nothing to draw: no actual, no budget, a budget of zero or below
 * (no scale can be made from it), or a range under 1 (the budget would fall off the end of the scale).
 *
 * `decimals` is how many decimals the screen shows. "Over" is judged on the numbers as they are written, so a meter
 * never says "over scale" about 0.6 against a 0.6 maximum.
 */
export function gaugeModel(actual: number | null, budget: number | null, rangeOfBudget: number, decimals?: number): GaugeModel | null {
  if (!finite(actual) || !finite(budget) || budget <= 0) return null
  if (!Number.isFinite(rangeOfBudget) || rangeOfBudget < 1) return null
  const scaleMax = budget * rangeOfBudget
  const clampedActual = Math.min(Math.max(actual, 0), scaleMax)
  const over = decimals === undefined ? actual > scaleMax : roundTo(actual, decimals) > roundTo(scaleMax, decimals)
  return {
    budget,
    actual,
    scaleMax,
    clampedActual,
    fraction: clampedActual / scaleMax,
    budgetFraction: 1 / rangeOfBudget,
    over,
  }
}

/** A point on the semicircle: fraction 0 is the left end, 0.5 the top, 1 the right end. y grows downwards, as in SVG. */
export function arcPoint(cx: number, cy: number, radius: number, fraction: number): { x: number; y: number } {
  const angle = Math.PI * (1 - fraction)
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** An SVG path along the semicircle from one fraction to another (left to right). Empty when there is no length to draw. */
export function arcPath(cx: number, cy: number, radius: number, from: number, to: number): string {
  if (to <= from) return ''
  const a = arcPoint(cx, cy, radius, from)
  const b = arcPoint(cx, cy, radius, to)
  return `M ${round2(a.x)} ${round2(a.y)} A ${radius} ${radius} 0 0 1 ${round2(b.x)} ${round2(b.y)}`
}

/**
 * What a screen reader says for the meter (its aria-valuetext): the real value, the budget, where the scale ends, and
 * whether the value is beyond it. `format` writes a number with its unit; `planWord` is "budget" or "target".
 */
export function gaugeValueText(model: GaugeModel, format: (value: number) => string, planWord: string): string {
  const base = `${format(model.actual)}, ${planWord} ${format(model.budget)}, scale 0 to ${format(model.scaleMax)}.`
  return model.over ? `${base} Off the scale: the value is beyond the end of the meter.` : base
}
