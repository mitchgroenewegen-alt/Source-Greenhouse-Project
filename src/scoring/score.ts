// Turns an actual and a target into a green / amber / red status.
// The thresholds and directions come from src/config/kpis.ts; nothing is hard-coded here.

import { kpiConfig, type KpiConfig } from '../config/kpis'

export type Status = 'green' | 'amber' | 'red'

export interface Score {
  /** null when the KPI cannot be scored (no target, or no actual). */
  status: Status | null
  /** Percent points or unit, depending on the KPI's variance mode. Can be +/-Infinity when the target is 0. */
  variance: number | null
  /** Why there is no status, when there is none. */
  reason?: 'no-target' | 'no-actual'
}

export const STATUS_RANK: Record<Status, number> = { green: 0, amber: 1, red: 2 }

export const STATUS_LABEL: Record<Status, string> = { green: 'On track', amber: 'Watch', red: 'Off target' }

/** Slack for floating point noise when a variance sits exactly on a threshold. */
const EPSILON = 1e-9

export function worstStatus(a: Status | null, b: Status | null): Status | null {
  if (a === null) return b
  if (b === null) return a
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a
}

/** actual compared with target: percent of |target|, or the plain difference. */
export function varianceOf(actual: number, target: number, mode: KpiConfig['variance']): number {
  if (mode === 'absolute') return actual - target
  if (target === 0) return actual === 0 ? 0 : actual > 0 ? Infinity : -Infinity
  return ((actual - target) / Math.abs(target)) * 100
}

export function statusFromVariance(config: KpiConfig, variance: number): Status {
  const { green, amber } = config
  switch (config.direction) {
    case 'higher': // falling short is bad, beating the target is fine
      if (variance >= -green - EPSILON) return 'green'
      if (variance >= -amber - EPSILON) return 'amber'
      return 'red'
    case 'lower': // overshooting is bad, undershooting is fine
      if (variance <= green + EPSILON) return 'green'
      if (variance <= amber + EPSILON) return 'amber'
      return 'red'
    case 'target': // either side is bad
      if (Math.abs(variance) <= green + EPSILON) return 'green'
      if (Math.abs(variance) <= amber + EPSILON) return 'amber'
      return 'red'
  }
}

export function scoreWith(config: KpiConfig, actual: number | null, target: number | null): Score {
  if (target === null) return { status: null, variance: null, reason: 'no-target' }
  if (actual === null) return { status: null, variance: null, reason: 'no-actual' }
  const variance = varianceOf(actual, target, config.variance)
  return { status: statusFromVariance(config, variance), variance }
}

export function scoreKpi(kpiName: string, actual: number | null, target: number | null): Score {
  return scoreWith(kpiConfig(kpiName), actual, target)
}
