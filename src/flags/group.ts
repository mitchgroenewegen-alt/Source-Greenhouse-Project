import { diffDays, formatDate } from '../data/dates'
import type { DailyRow } from '../data/types'
import { hasKpiConfig, kpiConfig, planWord } from '../config/kpis'
import { plain, withUnit } from '../lib/format'
import type { Field, Flag, FlagGroup, RuleId } from './types'

/** The titles of the rules in a list or filter, where one title covers budget KPIs and target KPIs alike. */
export const RULE_TITLE: Record<RuleId, string> = {
  'unit-fahrenheit': 'Fahrenheit entered as Celsius',
  'unit-fraction': 'Fraction entered as percent',
  'unit-factor-10': 'Factor of 10 slip',
  'impossible-value': 'Impossible value',
  'jump-vs-median': 'Jump against the usual value',
  'target-actual-apart': 'Plan and actual far apart',
  'missing-value': 'Missing value',
}

/** The title on a card, in the plan word of its own KPI: "Budget and actual far apart" or "Target and actual far apart". */
export function ruleTitleFor(rule: RuleId, kpi: string): string {
  return rule === 'target-actual-apart' ? `${fieldWord('target', kpi, { capitalised: true })} and actual far apart` : RULE_TITLE[rule]
}

/**
 * How a column of the KPIs sheet is named for this KPI: "actual", or the KPI's plan word ("budget" or "target").
 * A decision imported for a KPI that is no longer in the data falls back to "target", the column's name in the workbook.
 */
export function fieldWord(field: Field, kpi: string, { capitalised = false }: { capitalised?: boolean } = {}): string {
  const word = field === 'actual' ? 'actual' : hasKpiConfig(kpi) ? planWord(kpiConfig(kpi)) : 'target'
  return capitalised ? word.charAt(0).toUpperCase() + word.slice(1) : word
}

export const RULE_ORDER: RuleId[] = [
  'unit-fahrenheit',
  'unit-fraction',
  'unit-factor-10',
  'impossible-value',
  'jump-vs-median',
  'target-actual-apart',
  'missing-value',
]

const SUGGESTION_NOTE: Partial<Record<RuleId, string>> = {
  'unit-fahrenheit': 'convert from Fahrenheit to Celsius',
  'unit-fraction': 'multiply by 100',
  'unit-factor-10': 'move the decimal point one place',
}

/** Longest calendar gap between two flagged dates that still counts as "consecutive" (weekly KPIs are 7 days apart). */
const MAX_GAP_DAYS = 7

function describeGroup(group: Omit<FlagGroup, 'explanation' | 'suggestionNote' | 'id'>): string {
  const { flags, field, rule, startDate, endDate } = group
  const first = flags[0]!
  const span =
    flags.length === 1
      ? `on ${formatDate(startDate)}`
      : `on ${flags.length} ${isDaily(flags) ? 'days' : 'dates'} from ${formatDate(startDate)} to ${formatDate(endDate)}`
  const fieldName = fieldWord(field, group.kpi)
  if (rule === 'missing-value') return `No ${fieldName} was recorded ${span}.`
  const values = flags.map((f) => f.value).filter((v): v is number => v !== null)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const unit = kpiConfig(group.kpi).unit
  const range = flags.length === 1 || lo === hi ? withUnit(first.value ?? 0, unit) : `${plain(lo)} to ${withUnit(hi, unit)}`
  const hint = first.suggestion !== null ? ` ${suggestionSentence(group.flags, rule)}` : ''
  switch (rule) {
    case 'unit-fahrenheit':
      return `The ${fieldName} reads ${range} ${span}, which looks like Fahrenheit entered as Celsius.${hint}`
    case 'unit-fraction':
      return `The ${fieldName} reads ${range} ${span}, which looks like a fraction entered where a percent belongs.${hint}`
    case 'unit-factor-10':
      return `The ${fieldName} reads ${range} ${span}, which looks like a slipped decimal point.${hint}`
    case 'impossible-value':
      return `The ${fieldName} reads ${range} ${span}, which is not possible for this KPI.`
    case 'jump-vs-median':
      return `The ${fieldName} reads ${range} ${span}, far from this cultivation's usual value for this KPI.`
    case 'target-actual-apart':
      return `Week by week, the ${fieldName} is more than 2.5 times away from the actual ${span}.`
  }
}

function suggestionSentence(flags: Flag[], rule: RuleId): string {
  const suggestions = flags.map((f) => f.suggestion).filter((s): s is number => s !== null)
  const lo = Math.min(...suggestions)
  const hi = Math.max(...suggestions)
  const unit = kpiConfig(flags[0]!.kpi).unit
  const range = lo === hi ? withUnit(lo, unit) : `${plain(lo)} to ${withUnit(hi, unit)}`
  return `Suggested: ${SUGGESTION_NOTE[rule]}, giving ${range}.`
}

function isDaily(flags: Flag[]): boolean {
  return flags.length < 2 || diffDays(flags[1]!.date, flags[0]!.date) === 1
}

/**
 * Collapse flags of the same cultivation, KPI, column and rule on consecutive dates into one item.
 * `rows` is used to know which dates exist for each series, so a weekly KPI's next week counts as consecutive.
 */
export function groupFlags(flags: Flag[], rows: DailyRow[]): FlagGroup[] {
  const datesBySeries = new Map<string, string[]>()
  for (const r of rows) {
    const key = `${r.cultivation}|${r.kpi}`
    const list = datesBySeries.get(key)
    if (list) list.push(r.date)
    else datesBySeries.set(key, [r.date])
  }
  const position = new Map<string, Map<string, number>>()
  for (const [key, dates] of datesBySeries) {
    dates.sort()
    position.set(key, new Map(dates.map((d, i) => [d, i])))
  }

  const buckets = new Map<string, Flag[]>()
  for (const f of flags) {
    const key = `${f.cultivation}|${f.kpi}|${f.field}|${f.rule}`
    const list = buckets.get(key)
    if (list) list.push(f)
    else buckets.set(key, [f])
  }

  const groups: FlagGroup[] = []
  for (const list of buckets.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    const index = position.get(`${list[0]!.cultivation}|${list[0]!.kpi}`)!
    let run: Flag[] = []
    const close = () => {
      if (run.length === 0) return
      const first = run[0]!
      const base = {
        cultivation: first.cultivation,
        kpi: first.kpi,
        field: first.field as Field,
        rule: first.rule,
        severity: first.severity,
        startDate: first.date,
        endDate: run[run.length - 1]!.date,
        flags: run,
      }
      groups.push({
        ...base,
        id: `${first.cultivation}|${first.kpi}|${first.field}|${first.rule}|${first.date}`,
        explanation: describeGroup(base),
        suggestionNote: first.suggestion !== null ? (SUGGESTION_NOTE[first.rule] ?? null) : null,
      })
      run = []
    }
    for (const f of list) {
      const prev = run[run.length - 1]
      const consecutive =
        prev !== undefined &&
        index.get(f.date)! - index.get(prev.date)! === 1 &&
        diffDays(f.date, prev.date) <= MAX_GAP_DAYS
      if (!consecutive) close()
      run.push(f)
    }
    close()
  }
  return groups
}
