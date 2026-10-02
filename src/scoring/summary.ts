// Scores one cultivation for one week: every KPI, then a status per category.

import { CATEGORY_ORDER, CATEGORY_ROLLUP, KPI_CONFIG, type KpiConfig } from '../config/kpis'
import type { Category } from '../data/types'
import { weeklyKey, type WeeklyLookup, type WeeklyPoint } from './effective'
import { scoreWith, STATUS_RANK, type Score, type Status } from './score'

export interface KpiResult {
  config: KpiConfig
  point: WeeklyPoint | undefined
  score: Score
  /** Why there is no status: nothing to compare with, or the value is waiting for a decision. */
  note: 'no-target' | 'no-actual' | 'under-review' | null
}

export interface CategoryResult {
  category: Category
  /** From the share of scored KPIs that are red or green (CATEGORY_ROLLUP). null when no KPI of the category is scored. */
  status: Status | null
  /** The worst KPI of the category, named on the badge line whatever the category's own status is. */
  worst: KpiResult | null
  scoredCount: number
  counts: Record<Status, number>
  /** KPIs of the category whose week is waiting for a data-check decision. */
  underReview: number
}

export interface CultivationScore {
  cultivation: string
  week: string
  kpis: KpiResult[]
  categories: CategoryResult[]
}

/** How far a score is into the bad direction, in units of the amber tolerance. Used to pick the worst KPI. */
export function badness(config: KpiConfig, variance: number | null): number {
  if (variance === null) return 0
  const bad =
    config.direction === 'higher' ? Math.max(0, -variance) : config.direction === 'lower' ? Math.max(0, variance) : Math.abs(variance)
  return bad / config.amber
}

/** Slack for floating point noise when a share sits exactly on a threshold such as 1/3. */
const SHARE_EPSILON = 1e-9

/**
 * A category's status from how many of its scored KPIs are green, amber and red:
 * red if at least `redShare` are red, else green if at least `greenShare` are green, else amber.
 */
export function rollupStatus(counts: Record<Status, number>, rollup: { redShare: number; greenShare: number } = CATEGORY_ROLLUP): Status | null {
  const scored = counts.green + counts.amber + counts.red
  if (scored === 0) return null
  if (counts.red / scored >= rollup.redShare - SHARE_EPSILON) return 'red'
  if (counts.green / scored >= rollup.greenShare - SHARE_EPSILON) return 'green'
  return 'amber'
}

export function scoreKpiResult(config: KpiConfig, point: WeeklyPoint | undefined): KpiResult {
  const comparable = point?.paired ? point : undefined
  const score = scoreWith(config, comparable?.actual ?? null, comparable?.target ?? null)
  let note: KpiResult['note'] = null
  if (score.status === null) {
    if (point && point.openFlags > 0) note = 'under-review'
    else note = score.reason ?? null
  }
  return { config, point, score, note }
}

export function scoreCultivationWeek(lookup: WeeklyLookup, cultivation: string, week: string): CultivationScore {
  const kpis = KPI_CONFIG.map((config) => scoreKpiResult(config, lookup.get(weeklyKey(cultivation, config.name, week))))
  const categories = CATEGORY_ORDER.map((category): CategoryResult => {
    const scored = kpis.filter((k) => k.config.category === category && k.score.status !== null)
    let worst: KpiResult | null = null
    for (const k of scored) {
      if (
        worst === null ||
        STATUS_RANK[k.score.status!] > STATUS_RANK[worst.score.status!] ||
        (k.score.status === worst.score.status && badness(k.config, k.score.variance) > badness(worst.config, worst.score.variance))
      ) {
        worst = k
      }
    }
    const counts: Record<Status, number> = { green: 0, amber: 0, red: 0 }
    for (const k of scored) counts[k.score.status!]++
    const underReview = kpis.filter((k) => k.config.category === category && k.note === 'under-review').length
    return { category, status: rollupStatus(counts), worst, scoredCount: scored.length, counts, underReview }
  })
  return { cultivation, week, kpis, categories }
}

/** A sort key for "worst first": red categories, then amber ones, then the shortfall on cumulative harvest. */
export function attentionKey(score: CultivationScore): [number, number, number] {
  const count = (s: Status) => score.categories.filter((c) => c.status === s).length
  const cumulative = score.kpis.find((k) => k.config.name === 'Cumulative harvest')?.score.variance ?? 0
  return [count('red'), count('amber'), -Math.min(cumulative, 1e6)]
}

export function compareByAttention(a: CultivationScore, b: CultivationScore): number {
  const ka = attentionKey(a)
  const kb = attentionKey(b)
  return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2] || a.cultivation.localeCompare(b.cultivation)
}
