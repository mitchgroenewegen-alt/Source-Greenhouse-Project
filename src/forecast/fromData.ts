import type { DataFile } from '../data/types'
import type { PointOf } from './types'

/**
 * A weekly lookup straight from a DataFile's weekly rows (no data checks or decisions applied). The app itself passes its `point`
 * lookup, which has those applied, so the forecast uses the same numbers as the scores; this one is for tests and tools.
 */
export function pointOfData(data: Pick<DataFile, 'weekly'>): PointOf {
  const lookup = new Map(data.weekly.map((w) => [`${w.cultivation}|${w.kpi}|${w.week}`, w]))
  return (cultivation, kpi, week) => lookup.get(`${cultivation}|${kpi}|${week}`)
}
