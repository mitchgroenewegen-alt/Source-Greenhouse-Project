import { planWord, type KpiConfig } from '../config/kpis'
import { fixed, signedNumber, signedPercent } from './format'

export const NO_VALUE = '–'

/** "84.44" for a KPI value, or an en dash when nothing is recorded. */
export function formatValue(config: KpiConfig, value: number | null): string {
  return value === null ? NO_VALUE : fixed(value, config.decimals)
}

export function formatValueWithUnit(config: KpiConfig, value: number | null): string {
  return value === null ? NO_VALUE : `${fixed(value, config.decimals)}${config.unit === '%' ? ' %' : ` ${config.unit}`}`
}

/** "+5.7%" for percent KPIs, "+1.2 °C" for absolute ones. */
export function formatVariance(config: KpiConfig, variance: number | null): string {
  if (variance === null) return NO_VALUE
  if (config.variance === 'percent') return signedPercent(variance, Math.abs(variance) >= 100 ? 0 : 1, planWord(config))
  return `${signedNumber(variance, config.decimals)} ${absoluteUnit(config, true)}`
}

/** The unit for an absolute difference. A difference between two percentages is in percentage points. */
function absoluteUnit(config: KpiConfig, short = false): string {
  return config.unit === '%' ? (short ? 'pts' : 'percentage points') : config.unit
}

/** What green and amber mean for this KPI, in words. The plan value is named "budget" or "target" as the KPI's planLabel says. */
export function toleranceText(config: KpiConfig): { green: string; amber: string } {
  const unit = config.variance === 'percent' ? '%' : ` ${absoluteUnit(config)}`
  const g = `${config.green}${unit}`
  const a = `${config.amber}${unit}`
  const plan = planWord(config)
  switch (config.direction) {
    case 'higher':
      return { green: `no more than ${g} below ${plan} (or above it)`, amber: `up to ${a} below ${plan}` }
    case 'lower':
      return { green: `no more than ${g} above ${plan} (or below it)`, amber: `up to ${a} above ${plan}` }
    case 'target':
      return { green: `within ±${g} of ${plan}`, amber: `within ±${a} of ${plan}` }
  }
}

export function directionText(config: KpiConfig): string {
  return config.direction === 'higher' ? 'Higher is better' : config.direction === 'lower' ? 'Lower is better' : `Close to ${planWord(config)} is best`
}
