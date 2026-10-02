// The KPI rulebook. Everything that decides a green / amber / red score lives in this file.
//
// To change a threshold, edit the numbers on the KPI's line. To score a KPI differently, swap the
// helper (higherIsBetter, lowerIsBetter, closeToTarget, closeToTargetAbsolute).
//
// How a variance is read (variance = actual compared with target, see src/scoring/score.ts):
//   higher is better : green if variance >= -green,  amber if variance >= -amber,  else red
//   lower is better  : green if variance <= +green,  amber if variance <= +amber,  else red
//   close to target  : green if |variance| <= green, amber if |variance| <= amber, else red
// Percent variance is (actual - target) / |target| in %, absolute variance is actual - target in the KPI's unit.
// A KPI with no target for the period is shown but never scored.

import type { Aggregation, Category } from '../data/types'

export type Direction = 'higher' | 'lower' | 'target'
export type VarianceMode = 'percent' | 'absolute'

export interface KpiConfig {
  name: string
  category: Category
  unit: string
  /** How days add up to a week. Must match the KPI dictionary in the workbook (checked when the data is prepared). */
  aggregation: Aggregation
  direction: Direction
  variance: VarianceMode
  /** Green tolerance: percent points (variance 'percent') or unit (variance 'absolute'). */
  green: number
  /** Amber tolerance, same scale as green. Beyond this the KPI is red. */
  amber: number
  /** Headline numbers shown on each cultivation card in the Scorecard. */
  showOnScorecard: boolean
  /** Decimals when showing a value. */
  decimals: number
}

type Tolerance = Pick<KpiConfig, 'direction' | 'variance' | 'green' | 'amber'>

const higherIsBetter = (green = 3, amber = 8): Tolerance => ({ direction: 'higher', variance: 'percent', green, amber })
const lowerIsBetter = (green = 5, amber = 15): Tolerance => ({ direction: 'lower', variance: 'percent', green, amber })
const closeToTarget = (green = 5, amber = 10): Tolerance => ({ direction: 'target', variance: 'percent', green, amber })
const closeToTargetAbsolute = (green: number, amber: number): Tolerance => ({ direction: 'target', variance: 'absolute', green, amber })

/** Temperatures: green within 1 degree C, amber within 2 degrees C. */
const temperature = closeToTargetAbsolute(1, 2)

export const KPI_CONFIG: KpiConfig[] = [
  // Production
  { name: 'Harvest', category: 'Production', unit: 'kg/m²', aggregation: 'sum', ...higherIsBetter(), showOnScorecard: true, decimals: 2 },
  { name: 'Cumulative harvest', category: 'Production', unit: 'kg/m²', aggregation: 'last', ...higherIsBetter(), showOnScorecard: true, decimals: 2 },
  { name: 'Fruit weight', category: 'Production', unit: 'g', aggregation: 'average', ...closeToTarget(), showOnScorecard: true, decimals: 1 },
  { name: 'Waste', category: 'Production', unit: '%', aggregation: 'last', ...lowerIsBetter(), showOnScorecard: true, decimals: 1 },

  // Plant
  { name: 'Head thickness', category: 'Plant', unit: 'mm', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Length growth', category: 'Plant', unit: 'cm/week', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Flowering height', category: 'Plant', unit: 'cm', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Leaf length', category: 'Plant', unit: 'cm', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Leaves per stem', category: 'Plant', unit: 'leaves', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Flowering speed', category: 'Plant', unit: 'trusses/week', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Set speed', category: 'Plant', unit: 'trusses/week', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Fruit set', category: 'Plant', unit: 'fruits/m²/week', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Plant load', category: 'Plant', unit: 'fruits/m²', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 0 },
  { name: 'Fruits per truss (after pruning)', category: 'Plant', unit: 'fruits/truss', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  // Index KPIs: the plan is 0 (balanced), so the tolerance is in index points, not percent.
  { name: 'Plant balance factor', category: 'Plant', unit: 'index', aggregation: 'average', ...closeToTargetAbsolute(0.25, 0.5), showOnScorecard: false, decimals: 2 },
  { name: 'Generative trend indicator', category: 'Plant', unit: 'index', aggregation: 'average', ...closeToTargetAbsolute(0.15, 0.3), showOnScorecard: false, decimals: 2 },
  { name: 'Fruit development time', category: 'Plant', unit: 'days', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },

  // Climate
  { name: 'Temperature (24h)', category: 'Climate', unit: '°C', aggregation: 'average', ...temperature, showOnScorecard: false, decimals: 1 },
  { name: 'Temperature (day)', category: 'Climate', unit: '°C', aggregation: 'average', ...temperature, showOnScorecard: false, decimals: 1 },
  { name: 'Temperature (night)', category: 'Climate', unit: '°C', aggregation: 'average', ...temperature, showOnScorecard: false, decimals: 1 },
  { name: 'Day/night temperature difference', category: 'Climate', unit: '°C', aggregation: 'average', ...temperature, showOnScorecard: false, decimals: 1 },
  { name: 'Relative humidity', category: 'Climate', unit: '%', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Humidity deficit', category: 'Climate', unit: 'g/kg', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'CO2 (day)', category: 'Climate', unit: 'ppm', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 0 },
  { name: 'Solar radiation', category: 'Climate', unit: 'J/cm²', aggregation: 'sum', ...closeToTarget(), showOnScorecard: false, decimals: 0 },
  { name: 'PAR light sum', category: 'Climate', unit: 'mol/m²', aggregation: 'sum', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'RTR (radiation-temperature ratio)', category: 'Climate', unit: '°C per J/cm²', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 4 },

  // Irrigation
  { name: 'Irrigation per unit of light', category: 'Irrigation', unit: 'dl per MJ/m²', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Drain', category: 'Irrigation', unit: '%', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Drain EC', category: 'Irrigation', unit: 'mS/cm', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Drain pH', category: 'Irrigation', unit: 'pH', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Dry-down at first irrigation', category: 'Irrigation', unit: '%', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'First irrigation after sunrise', category: 'Irrigation', unit: 'hours', aggregation: 'average', ...closeToTarget(), showOnScorecard: false, decimals: 1 },

  // Resource usage
  { name: 'Irrigation water', category: 'Resource usage', unit: 'L/m²', aggregation: 'sum', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Heating energy (approx.)', category: 'Resource usage', unit: 'kWh/m²', aggregation: 'sum', ...lowerIsBetter(), showOnScorecard: false, decimals: 2 },
  { name: 'LED lighting', category: 'Resource usage', unit: 'hours', aggregation: 'sum', ...lowerIsBetter(), showOnScorecard: false, decimals: 1 },
]

const BY_NAME = new Map(KPI_CONFIG.map((k) => [k.name, k]))

export function kpiConfig(name: string): KpiConfig {
  const config = BY_NAME.get(name)
  if (!config) throw new Error(`No KPI configured with the name "${name}" - add it to src/config/kpis.ts`)
  return config
}

export function hasKpiConfig(name: string): boolean {
  return BY_NAME.has(name)
}

/** Categories in the order they are shown, with the short label used on badges and tabs. */
export const CATEGORY_ORDER: Category[] = ['Production', 'Plant', 'Climate', 'Irrigation', 'Resource usage']

export const CATEGORY_LABEL: Record<Category, string> = {
  Production: 'Production',
  Plant: 'Plant',
  Climate: 'Climate',
  Irrigation: 'Irrigation',
  'Resource usage': 'Resources',
}

export function kpisInCategory(category: Category): KpiConfig[] {
  return KPI_CONFIG.filter((k) => k.category === category)
}
