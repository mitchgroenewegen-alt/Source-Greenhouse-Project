// The status of one day of one climate KPI, for the days-off-target strip. It is the same rule as everywhere else:
// scoreKpi() from src/scoring/score.ts with the tolerances of src/config/kpis.ts, applied to one day instead of a week.
// The one addition is the data checks:
//
//   a value or target that the data checks flagged and nobody has decided on  -> "flagged", never red or green
//   confirmed or corrected (the corrected value is the one in use)           -> scored like any other day
//   excluded                                                                 -> no value, so "no data"
//   "Show raw data" on                                                       -> scored from the value as recorded, and still marked
//
// So PA-P2-TOV's days with a 69 target (a Fahrenheit slip: 69 F is 20.6 C) read "flagged" until someone confirms
// the 69 (then they are red, because the day really is far from it), corrects it (scored against 20.6) or excludes it.

import { scoreKpi, type Status } from '../scoring/score'
import type { DayCell } from './days'

export type DayKind = Status | 'flagged' | 'none'

export interface DayVerdict {
  kind: DayKind
  /** A flagged value is still waiting for a decision (even when "Show raw data" scores it anyway). */
  open: boolean
  /** A person has decided about a flagged value of this day. */
  checked: boolean
  /** One plain sentence for the cell's tooltip and screen-reader text. */
  reason: string
}

export function dayVerdict(kpi: string, cell: DayCell | undefined, { raw = false }: { raw?: boolean } = {}): DayVerdict {
  if (!cell) return { kind: 'none', open: false, checked: false, reason: 'no value recorded' }
  const open = cell.actualState === 'open' || cell.targetState === 'open'
  const checked = [cell.actualState, cell.targetState].some((s) => s === 'confirmed' || s === 'corrected' || s === 'excluded')
  if (open && !raw) {
    const which = cell.actualState === 'open' && cell.targetState === 'open' ? 'actual and target' : cell.actualState === 'open' ? 'actual' : 'target'
    return { kind: 'flagged', open, checked, reason: `the ${which} is flagged by the data checks and not decided yet, so the day is not scored` }
  }
  const score = scoreKpi(kpi, cell.actual, cell.target)
  if (score.status === null) {
    const excluded = cell.actualState === 'excluded' || cell.targetState === 'excluded'
    const reason = excluded ? 'a value was excluded after a data check' : score.reason === 'no-target' ? 'no target for this day' : 'no value recorded'
    return { kind: 'none', open, checked, reason }
  }
  return { kind: score.status, open, checked, reason: open ? 'scored from the value as recorded (Show raw data is on); it is flagged by the data checks' : '' }
}

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  green: 'On track',
  amber: 'Watch',
  red: 'Off target',
  flagged: 'Flagged',
  none: 'No data',
}

/** The strip's counts for a run of days: how many of each kind. */
export function countKinds(verdicts: readonly DayVerdict[]): Record<DayKind, number> {
  const counts: Record<DayKind, number> = { green: 0, amber: 0, red: 0, flagged: 0, none: 0 }
  for (const v of verdicts) counts[v.kind]++
  return counts
}
