// The KPI rulebook. Everything that decides a green / amber / red score lives in this file.
//
// To change a threshold, edit the numbers on the KPI's line (or the helper's defaults just below, which
// most lines use). To score a KPI differently, swap the helper (higherIsBetter, lowerIsBetter,
// lowerIsBetterAbsolute, closeToTarget, closeToTargetAbsolute).
//
// How a variance is read (variance = actual compared with target, see src/scoring/score.ts):
//   higher is better : green if variance >= -green,  amber if variance >= -amber,  else red
//   lower is better  : green if variance <= +green,  amber if variance <= +amber,  else red
//   close to target  : green if |variance| <= green, amber if |variance| <= amber, else red
// Percent variance is (actual - target) / |target| in %, absolute variance is actual - target in the KPI's unit.
// A KPI with no target for the period is shown but never scored.
//
// What the plan value is called on screen is each KPI's `planLabel`: 'budget' for Production and for Heating energy
// and LED lighting, 'target' for the growing KPIs (Plant, Climate, Irrigation, Irrigation water). The workbook calls
// the column "Target" for all of them; this only changes the word people read. Change a KPI's `planLabel` here and
// every screen follows.
//
// A KPI with `gauge: { rangeOfBudget: 1.2 }` gets a meter on its Scorecard tile (Waste has one). The meter runs from 0 to that
// multiple of the week's budget or target; delete the setting to remove the meter, or add it to another Scorecard KPI.
//
// A category (Production, Plant, ...) is then rated from the share of its scored KPIs that are red or green:
// see CATEGORY_ROLLUP at the bottom of this file.

import type { Aggregation, Category } from '../data/types'

export type Direction = 'higher' | 'lower' | 'target'
export type VarianceMode = 'percent' | 'absolute'
/** The word for the plan value on screen. */
export type PlanLabel = 'budget' | 'target'

export interface KpiConfig {
  name: string
  category: Category
  unit: string
  /** How days add up to a week. Must match the KPI dictionary in the workbook (checked when the data is prepared). */
  aggregation: Aggregation
  /** What the plan value is called in the UI: a budget (Production, Heating energy, LED lighting) or a target (the growing KPIs). */
  planLabel: PlanLabel
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
  /**
   * A semicircular meter under the value on the Scorecard tile. The scale runs from 0 to `rangeOfBudget` x the week's
   * budget or target (1 or more; 1.2 means 120 % of it), with a tick at the budget. Leave it out for a KPI with no meter.
   */
  gauge?: { rangeOfBudget: number }
}

type Tolerance = Pick<KpiConfig, 'direction' | 'variance' | 'green' | 'amber'>

// The defaults below are the ones most KPIs use. Production's yield KPIs are held tighter than the rest,
// because plant, climate and irrigation KPIs typically swing about 10 % from week to week.
const higherIsBetter = (green = 3, amber = 8): Tolerance => ({ direction: 'higher', variance: 'percent', green, amber })
const lowerIsBetter = (green = 10, amber = 25): Tolerance => ({ direction: 'lower', variance: 'percent', green, amber })
const lowerIsBetterAbsolute = (green: number, amber: number): Tolerance => ({ direction: 'lower', variance: 'absolute', green, amber })
const closeToTarget = (green = 10, amber = 20): Tolerance => ({ direction: 'target', variance: 'percent', green, amber })
const closeToTargetAbsolute = (green: number, amber: number): Tolerance => ({ direction: 'target', variance: 'absolute', green, amber })

/** Temperatures: green within 1.5 degrees C, amber within 3 degrees C. */
const temperature = closeToTargetAbsolute(1.5, 3)

export const KPI_CONFIG: KpiConfig[] = [
  // Production
  { name: 'Harvest', category: 'Production', unit: 'kg/m²', aggregation: 'sum', planLabel: 'budget', ...higherIsBetter(), showOnScorecard: true, decimals: 2 },
  { name: 'Cumulative harvest', category: 'Production', unit: 'kg/m²', aggregation: 'last', planLabel: 'budget', ...higherIsBetter(), showOnScorecard: true, decimals: 2 },
  { name: 'Fruit weight', category: 'Production', unit: 'g', aggregation: 'average', planLabel: 'budget', ...closeToTarget(5, 10), showOnScorecard: true, decimals: 1 },
  // Waste is a small percentage (about 1 to 5 %), so its tolerance is in percentage points: 0.6 % against a 0.5 % budget is fine.
  { name: 'Waste', category: 'Production', unit: '%', aggregation: 'last', planLabel: 'budget', ...lowerIsBetterAbsolute(0.5, 1.5), showOnScorecard: true, decimals: 1, gauge: { rangeOfBudget: 1.2 } },

  // Plant
  { name: 'Head thickness', category: 'Plant', unit: 'mm', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Length growth', category: 'Plant', unit: 'cm/week', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Flowering height', category: 'Plant', unit: 'cm', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Leaf length', category: 'Plant', unit: 'cm', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Leaves per stem', category: 'Plant', unit: 'leaves', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Flowering speed', category: 'Plant', unit: 'trusses/week', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Set speed', category: 'Plant', unit: 'trusses/week', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Fruit set', category: 'Plant', unit: 'fruits/m²/week', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Plant load', category: 'Plant', unit: 'fruits/m²', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 0 },
  { name: 'Fruits per truss (after pruning)', category: 'Plant', unit: 'fruits/truss', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  // Index KPIs: the plan is 0 (balanced), so the tolerance is in index points, not percent.
  { name: 'Plant balance factor', category: 'Plant', unit: 'index', aggregation: 'average', planLabel: 'target', ...closeToTargetAbsolute(0.25, 0.5), showOnScorecard: false, decimals: 2 },
  { name: 'Generative trend indicator', category: 'Plant', unit: 'index', aggregation: 'average', planLabel: 'target', ...closeToTargetAbsolute(0.15, 0.3), showOnScorecard: false, decimals: 2 },
  { name: 'Fruit development time', category: 'Plant', unit: 'days', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },

  // Climate
  { name: 'Temperature (24h)', category: 'Climate', unit: '°C', aggregation: 'average', planLabel: 'target', ...temperature, showOnScorecard: false, decimals: 1 },
  { name: 'Temperature (day)', category: 'Climate', unit: '°C', aggregation: 'average', planLabel: 'target', ...temperature, showOnScorecard: false, decimals: 1 },
  { name: 'Temperature (night)', category: 'Climate', unit: '°C', aggregation: 'average', planLabel: 'target', ...temperature, showOnScorecard: false, decimals: 1 },
  { name: 'Day/night temperature difference', category: 'Climate', unit: '°C', aggregation: 'average', planLabel: 'target', ...temperature, showOnScorecard: false, decimals: 1 },
  { name: 'Relative humidity', category: 'Climate', unit: '%', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Humidity deficit', category: 'Climate', unit: 'g/kg', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'CO2 (day)', category: 'Climate', unit: 'ppm', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 0 },
  { name: 'Solar radiation', category: 'Climate', unit: 'J/cm²', aggregation: 'sum', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 0 },
  { name: 'PAR light sum', category: 'Climate', unit: 'mol/m²', aggregation: 'sum', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'RTR (radiation-temperature ratio)', category: 'Climate', unit: '°C per J/cm²', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 4 },

  // Irrigation
  { name: 'Irrigation per unit of light', category: 'Irrigation', unit: 'dl per MJ/m²', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Drain', category: 'Irrigation', unit: '%', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Drain EC', category: 'Irrigation', unit: 'mS/cm', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Drain pH', category: 'Irrigation', unit: 'pH', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 2 },
  { name: 'Dry-down at first irrigation', category: 'Irrigation', unit: '%', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'First irrigation after sunrise', category: 'Irrigation', unit: 'hours', aggregation: 'average', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },

  // Resource usage
  { name: 'Irrigation water', category: 'Resource usage', unit: 'L/m²', aggregation: 'sum', planLabel: 'target', ...closeToTarget(), showOnScorecard: false, decimals: 1 },
  { name: 'Heating energy (approx.)', category: 'Resource usage', unit: 'kWh/m²', aggregation: 'sum', planLabel: 'budget', ...lowerIsBetter(), showOnScorecard: false, decimals: 2 },
  { name: 'LED lighting', category: 'Resource usage', unit: 'hours', aggregation: 'sum', planLabel: 'budget', ...lowerIsBetter(), showOnScorecard: false, decimals: 1 },
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

/** "budget" or "target" for this KPI's plan value, as it is written on screen. `capitalised` for the start of a sentence or a label. */
export function planWord(config: Pick<KpiConfig, 'planLabel'>, { capitalised = false }: { capitalised?: boolean } = {}): string {
  return capitalised ? config.planLabel.charAt(0).toUpperCase() + config.planLabel.slice(1) : config.planLabel
}

/**
 * The plan word for a group of KPIs: "budget", "target", or "budget or target" when they mix both (Resources does).
 * Used where the text names the plan value of a whole table or category rather than of one KPI.
 */
export function planWordForAll(configs: Pick<KpiConfig, 'planLabel'>[], { capitalised = false }: { capitalised?: boolean } = {}): string {
  const labels = (['budget', 'target'] as const).filter((label) => configs.some((c) => c.planLabel === label))
  const text = labels.length === 0 ? 'target' : labels.join(' or ')
  return capitalised ? text.charAt(0).toUpperCase() + text.slice(1) : text
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

/**
 * How the KPIs of a category add up to the category's status badge, among the KPIs that have a score that week:
 *   red    when at least `redShare` of them are red
 *   green  when at least `greenShare` of them are green (and fewer than `redShare` are red)
 *   amber  otherwise
 * The badge still names the worst KPI. Change the two fractions to make the badges stricter or kinder.
 */
export const CATEGORY_ROLLUP = { redShare: 1 / 3, greenShare: 2 / 3 }
