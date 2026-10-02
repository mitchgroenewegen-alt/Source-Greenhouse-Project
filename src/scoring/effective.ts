// Decides which value of each cell goes into scoring, then rolls the days up to weeks.
//
//   no flag                      -> the recorded value
//   flagged, nobody decided yet  -> left out (so a suspect value cannot move a score)
//   confirmed                    -> the recorded value
//   corrected                    -> the corrected value
//   excluded                     -> left out
//   "show raw data" switched on  -> always the recorded value, flags and decisions ignored
//
// A missing value has nothing to leave out, so it never counts as an open flag here.

import { kpiConfig } from '../config/kpis'
import { rollup } from '../data/aggregate'
import type { DailyRow } from '../data/types'
import type { Flag } from '../flags'
import { cellId } from '../flags'
import type { Decision } from '../storage/types'

export type CellState = 'clean' | 'open' | 'confirmed' | 'corrected' | 'excluded'

export interface EffectiveRow extends DailyRow {
  actualState: CellState
  targetState: CellState
}

export interface WeeklyPoint {
  week: string
  cultivation: string
  kpi: string
  actual: number | null
  target: number | null
  days: number
  /** True when actual and target come from the same days. Only paired points are scored. */
  paired: boolean
  /** Suspect values in this week still waiting for a decision. */
  openFlags: number
  /** Suspect values in this week that someone has decided about. */
  decidedFlags: number
}

const STATE_OF_DECISION = { confirm: 'confirmed', correct: 'corrected', exclude: 'excluded' } as const

function stateOf(flag: Flag | undefined, decision: Decision | undefined): CellState {
  if (decision) return STATE_OF_DECISION[decision.kind]
  if (flag && flag.rule !== 'missing-value') return 'open'
  return 'clean'
}

function valueOf(raw: number | null, state: CellState, decision: Decision | undefined): number | null {
  switch (state) {
    case 'clean':
    case 'confirmed':
      return raw
    case 'corrected':
      return decision?.correctedValue ?? null
    case 'open':
    case 'excluded':
      return null
  }
}

/** Apply flags and decisions to the daily rows. With `rawMode` the values stay as recorded (states are still worked out). */
export function applyDecisions(daily: DailyRow[], flags: Flag[], decisions: Decision[], rawMode: boolean): EffectiveRow[] {
  const flagById = new Map(flags.map((f) => [f.id, f]))
  const decisionById = new Map(decisions.map((d) => [d.cellId, d]))
  return daily.map((row) => {
    const actualId = cellId(row.cultivation, row.kpi, row.date, 'actual')
    const targetId = cellId(row.cultivation, row.kpi, row.date, 'target')
    const actualDecision = decisionById.get(actualId)
    const targetDecision = decisionById.get(targetId)
    const actualState = stateOf(flagById.get(actualId), actualDecision)
    const targetState = stateOf(flagById.get(targetId), targetDecision)
    return {
      ...row,
      actual: rawMode ? row.actual : valueOf(row.actual, actualState, actualDecision),
      target: rawMode ? row.target : valueOf(row.target, targetState, targetDecision),
      actualState,
      targetState,
    }
  })
}

export const weeklyKey = (cultivation: string, kpi: string, week: string) => `${cultivation}|${kpi}|${week}`

export type WeeklyLookup = Map<string, WeeklyPoint>

/** Roll the effective daily rows up to one point per cultivation, KPI and week, with the KPI's own rule. */
export function buildWeekly(rows: EffectiveRow[]): WeeklyLookup {
  const groups = new Map<string, EffectiveRow[]>()
  for (const row of rows) {
    const key = weeklyKey(row.cultivation, row.kpi, row.week)
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  const lookup: WeeklyLookup = new Map()
  for (const [key, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    const first = list[0]!
    const result = rollup(list, kpiConfig(first.kpi).aggregation)
    const states = list.flatMap((row) => [row.actualState, row.targetState])
    lookup.set(key, {
      week: first.week,
      cultivation: first.cultivation,
      kpi: first.kpi,
      actual: result.actual,
      target: result.target,
      days: result.days,
      paired: result.paired,
      openFlags: states.filter((s) => s === 'open').length,
      decidedFlags: states.filter((s) => s === 'confirmed' || s === 'corrected' || s === 'excluded').length,
    })
  }
  return lookup
}
