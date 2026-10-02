// Looks through the daily rows for values a person should verify. Pure functions, no screens.
//
// One cell gets at most one flag. When several rules fit, the most specific wins:
//   unit slip  >  impossible value  >  jump against the median  >  target and actual far apart
// "Far apart" is judged on the week (the grain of the scorecard) so one dull day does not raise it.
// Missing values are reported separately because there is nothing to check, only something to know.

import { kpiConfig } from '../config/kpis'
import { rollup } from '../data/aggregate'
import { addDays, cropWeekOn } from '../data/dates'
import type { Cultivation, DailyRow } from '../data/types'
import { plain, withUnit } from '../lib/format'
import { FLAG_THRESHOLDS as T, flagSettings, slipKinds, type KpiFlagSettings } from './settings'
import { cellId, type Field, type Flag, type RuleId, type Severity } from './types'

const SEVERITY: Record<RuleId, Severity> = {
  'unit-fahrenheit': 'error',
  'unit-fraction': 'error',
  'unit-factor-10': 'error',
  'impossible-value': 'error',
  'jump-vs-median': 'warning',
  'target-actual-apart': 'warning',
  'missing-value': 'info',
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

interface SeriesContext {
  kpi: string
  unit: string
  settings: KpiFlagSettings
  /** The cultivation's own typical (median) actual and target for this KPI. */
  typicalActual: number | null
  typicalTarget: number | null
  /** Harvest only: true when the cumulative harvest grew by this much that day, which proves a high day is real. */
  corroborated?: (date: string, value: number) => boolean
}

interface Hit {
  rule: RuleId
  explanation: string
  suggestion: number | null
}

/** Harvest and the change in cumulative harvest may differ by this much (kg/m²) and still agree. */
const HARVEST_AGREES_WITHIN = 0.01

const FIELD_NAME: Record<Field, string> = { actual: 'Actual', target: 'Target' }

function typicalOf(values: (number | null)[], settings: KpiFlagSettings): number | null {
  const present = values.filter((v): v is number => v !== null)
  return median(settings.zeroIsNormal ? present.filter((v) => v !== 0) : present)
}

/** Turn a suspect value into a candidate correction, if the value looks like a common slip. */
function findSlip(
  value: number,
  field: Field,
  ctx: SeriesContext,
): { rule: RuleId; explanation: string; suggestion: number } | null {
  const references = (field === 'actual' ? [ctx.typicalActual] : [ctx.typicalTarget, ctx.typicalActual]).filter(
    (r): r is number => r !== null && r > 0,
  )
  if (!ctx.settings.slips || references.length === 0 || value <= 0) return null
  const looksRight = (candidate: number) =>
    references.some((r) => candidate / r >= T.looksRightLow && candidate / r <= T.looksRightHigh)
  const typical = references[references.length - 1]!
  const name = FIELD_NAME[field]
  const slips = slipKinds(ctx.kpi)

  if (slips.fahrenheit) {
    const celsius = Number((((value - 32) * 5) / 9).toFixed(1))
    if (looksRight(celsius)) {
      return {
        rule: 'unit-fahrenheit',
        suggestion: celsius,
        explanation: `${name} is ${plain(value)} °C, which no greenhouse reaches. It looks like ${plain(value)} °F entered as °C; in °C that is about ${plain(celsius)} °C.`,
      }
    }
  }
  if (slips.fraction) {
    const percent = Number((value * 100).toPrecision(6))
    if (looksRight(percent)) {
      return {
        rule: 'unit-fraction',
        suggestion: percent,
        explanation: `${name} is ${plain(value)} %, but the usual value is about ${plain(typical)} %. It looks like a fraction (${plain(value)}) entered as a percent; times 100 gives ${plain(percent)} %.`,
      }
    }
  }
  for (const [factor, how] of [
    [10, 'times 10'],
    [0.1, 'divided by 10'],
  ] as const) {
    const fixed = Number((value * factor).toPrecision(6))
    if (looksRight(fixed)) {
      const direction = factor === 10 ? 'ten times too small' : 'ten times too big'
      return {
        rule: 'unit-factor-10',
        suggestion: fixed,
        explanation: `${name} is ${withUnit(value, ctx.unit)}, but the usual value is about ${withUnit(typical, ctx.unit)}. It looks ${direction} (a slipped decimal); ${how} gives ${plain(fixed)}.`,
      }
    }
  }
  return null
}

function impossibleReason(value: number, ctx: SeriesContext, field: Field): string | null {
  const { min, max } = ctx.settings
  const name = FIELD_NAME[field]
  const shown = withUnit(value, ctx.unit)
  if (ctx.kpi === 'Drain pH') {
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
      return `${name} drain pH of ${plain(value)} is outside the possible range of ${min} to ${max}.`
    }
    return null
  }
  if (min !== undefined && value < min) {
    return min === 0
      ? `${name} is ${shown}. A negative amount is not possible for this KPI.`
      : `${name} is ${shown}, below the lowest believable value (${plain(min)}).`
  }
  if (max !== undefined && value > max) {
    return `${name} is ${shown}, above the highest possible value (${plain(max)}).`
  }
  return null
}

function jumpDirection(value: number, typical: number | null, settings: KpiFlagSettings, young: boolean): 'high' | 'low' | null {
  if (typical === null || typical <= 0 || settings.jump === 'off') return null
  if (value === 0 && (settings.zeroIsNormal || young)) return null
  const ratio = value / typical
  if (ratio > T.jumpHigh) return 'high'
  if (ratio < T.jumpLow && settings.jump === 'both' && !young) return 'low'
  return null
}

function describeJump(value: number, typical: number, direction: 'high' | 'low', ctx: SeriesContext, field: Field): string {
  const name = FIELD_NAME[field]
  if (direction === 'high') {
    return `${name} is ${withUnit(value, ctx.unit)}, ${plain(value / typical, 2)} times this cultivation's usual value for the KPI (${withUnit(typical, ctx.unit)}).`
  }
  if (value === 0) return `${name} is 0, but this cultivation's usual value for the KPI is ${withUnit(typical, ctx.unit)}.`
  return `${name} is ${withUnit(value, ctx.unit)}, only ${plain((value / typical) * 100, 2)} % of this cultivation's usual value for the KPI (${withUnit(typical, ctx.unit)}).`
}

/** Per-cell checks: unit slip, impossible value, jump against the median. */
function checkValue(value: number, date: string, field: Field, ctx: SeriesContext, young: boolean): Hit | null {
  const typicalOwn = field === 'actual' ? ctx.typicalActual : ctx.typicalTarget
  const impossible = impossibleReason(value, ctx, field)
  let jump = jumpDirection(value, typicalOwn, ctx.settings, young)
  if (jump === 'high' && field === 'actual' && ctx.corroborated?.(date, value)) jump = null
  if (!impossible && !jump) return null

  const slip = findSlip(value, field, ctx)
  if (slip) return slip
  if (impossible) return { rule: 'impossible-value', explanation: impossible, suggestion: null }
  return { rule: 'jump-vs-median', explanation: describeJump(value, typicalOwn!, jump!, ctx, field), suggestion: null }
}

/** Is the ratio of target to actual outside the allowed spread (more than 2.5x apart either way)? */
export function isFarApart(target: number, actual: number): boolean {
  if (target <= 0 || actual <= 0) return false
  const ratio = target / actual
  return ratio > T.apartFactor || ratio < 1 / T.apartFactor
}

/** Every cell that should be verified, in cultivation, KPI and date order. */
export function detectFlags(daily: DailyRow[], cultivations: Cultivation[]): Flag[] {
  const planting = new Map(cultivations.map((c) => [c.id, c.plantingDate]))
  const series = new Map<string, DailyRow[]>()
  for (const row of daily) {
    const key = `${row.cultivation}|${row.kpi}`
    const list = series.get(key)
    if (list) list.push(row)
    else series.set(key, [row])
  }

  // Harvest and Cumulative harvest must agree: a big harvest day is believable when the running total grew by the same amount.
  const cumulative = new Map<string, number>()
  for (const row of daily) {
    if (row.kpi === 'Cumulative harvest' && row.actual !== null) cumulative.set(`${row.cultivation}|${row.date}`, row.actual)
  }
  const corroboratedBy = (cultivation: string) => (date: string, value: number) => {
    const today = cumulative.get(`${cultivation}|${date}`)
    const yesterday = cumulative.get(`${cultivation}|${addDays(date, -1)}`)
    return today !== undefined && yesterday !== undefined && Math.abs(today - yesterday - value) <= HARVEST_AGREES_WITHIN
  }

  const flags: Flag[] = []
  for (const rows of series.values()) {
    rows.sort((a, b) => a.date.localeCompare(b.date))
    const { cultivation, kpi } = rows[0]!
    const settings = flagSettings(kpi)
    const ctx: SeriesContext = {
      kpi,
      unit: kpiConfig(kpi).unit,
      settings,
      typicalActual: typicalOf(rows.map((r) => r.actual), settings),
      typicalTarget: typicalOf(rows.map((r) => r.target), settings),
      corroborated: kpi === 'Harvest' ? corroboratedBy(cultivation) : undefined,
    }
    const plantingDate = planting.get(cultivation)!
    const isYoung = (date: string) => cropWeekOn(plantingDate, date) <= T.youngCropWeeks

    const flagged = new Set<string>()
    const push = (row: DailyRow, field: Field, hit: Hit) => {
      const id = cellId(cultivation, kpi, row.date, field)
      flagged.add(id)
      flags.push({
        id,
        cultivation,
        kpi,
        date: row.date,
        field,
        value: row[field],
        rule: hit.rule,
        severity: SEVERITY[hit.rule],
        explanation: hit.explanation,
        suggestion: hit.suggestion,
      })
    }

    // Pass 1: one cell at a time.
    for (const row of rows) {
      const young = isYoung(row.date)
      if (row.actual === null) {
        push(row, 'actual', {
          rule: 'missing-value',
          suggestion: null,
          explanation: `Nothing was recorded for ${kpi} on this day. It is left out of the scores, never counted as zero.`,
        })
        continue
      }
      for (const field of ['actual', 'target'] as const) {
        const value = row[field]
        if (value === null) continue
        const hit = checkValue(value, row.date, field, ctx, young)
        if (hit) push(row, field, hit)
      }
    }

    // Pass 2: target against actual, week by week. The week's totals use only pairs that passed pass 1,
    // and when the week is too far apart every target of that week that is not flagged yet is flagged.
    const weeks = new Map<string, DailyRow[]>()
    for (const row of rows) {
      if (isYoung(row.date)) continue
      const list = weeks.get(row.week)
      if (list) list.push(row)
      else weeks.set(row.week, [row])
    }
    for (const [week, weekRows] of weeks) {
      const clean = weekRows.filter(
        (row) =>
          !flagged.has(cellId(cultivation, kpi, row.date, 'actual')) && !flagged.has(cellId(cultivation, kpi, row.date, 'target')),
      )
      const result = rollup(clean, kpiConfig(kpi).aggregation)
      if (!result.paired || result.actual === null || result.target === null) continue
      if (!isFarApart(result.target, result.actual)) continue
      const ratio = result.target / result.actual
      for (const row of weekRows) {
        if (row.target === null || flagged.has(cellId(cultivation, kpi, row.date, 'target'))) continue
        const slip = findSlip(row.target, 'target', ctx)
        push(
          row,
          'target',
          slip ?? {
            rule: 'target-actual-apart',
            suggestion: null,
            explanation: `In ${week.split('-')[1]} the target (${withUnit(result.target, ctx.unit)}) and the actual (${withUnit(result.actual, ctx.unit)}) are ${plain(ratio > 1 ? ratio : 1 / ratio, 2)} times apart. Either the plan or the measurement may be wrong.`,
          },
        )
      }
    }
  }
  return flags.sort(
    (a, b) => a.cultivation.localeCompare(b.cultivation) || a.kpi.localeCompare(b.kpi) || a.date.localeCompare(b.date) || a.field.localeCompare(b.field),
  )
}
