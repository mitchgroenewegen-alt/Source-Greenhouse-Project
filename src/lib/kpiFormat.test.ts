import { describe, expect, it } from 'vitest'
import { KPI_CONFIG, kpiConfig } from '../config/kpis'
import { signedPercent } from './format'
import { formatVariance, toleranceText } from './kpiFormat'

describe('absolute variances', () => {
  it('writes a difference between two percentages as percentage points', () => {
    expect(formatVariance(kpiConfig('Waste'), 0.5)).toMatch(/^\+0\.5 pts$/)
    expect(formatVariance(kpiConfig('Waste'), -1.1)).toMatch(/pts$/)
    expect(toleranceText(kpiConfig('Waste'))).toEqual({
      green: 'no more than 0.5 percentage points above budget (or below it)',
      amber: 'up to 1.5 percentage points above budget',
    })
  })

  it('keeps the KPI unit for everything else, and % for the percent-variance KPIs', () => {
    expect(formatVariance(kpiConfig('Temperature (24h)'), 1.5)).toContain('°C')
    expect(toleranceText(kpiConfig('Temperature (24h)')).green).toBe('within ±1.5 °C of target')
    expect(formatVariance(kpiConfig('Harvest'), -20)).toBe('-20.0%')
  })
})

describe('variance against a zero plan value', () => {
  // The weekly plan value can be 0 (PA-P2-TOV LED lighting has a 0 budget with hours actually run), so the variance is infinite.
  it('names the zero plan value with the KPI\'s own word', () => {
    expect(formatVariance(kpiConfig('LED lighting'), Infinity)).toBe('above a zero budget')
    expect(formatVariance(kpiConfig('LED lighting'), -Infinity)).toBe('below a zero budget')
    expect(formatVariance(kpiConfig('Harvest'), Infinity)).toBe('above a zero budget')
    expect(formatVariance(kpiConfig('Drain pH'), Infinity)).toBe('above a zero target')
    expect(formatVariance(kpiConfig('Irrigation water'), -Infinity)).toBe('below a zero target')
  })

  it('never says "target" for a budget KPI or "budget" for a target KPI, whatever the variance', () => {
    for (const k of KPI_CONFIG) {
      for (const variance of [Infinity, -Infinity, 12.5, -3, 0]) {
        const text = formatVariance(k, variance)
        expect(text, `${k.name} ${variance}`).not.toContain(k.planLabel === 'budget' ? 'target' : 'budget')
      }
      if (k.variance === 'percent') expect(formatVariance(k, Infinity), k.name).toBe(`above a zero ${k.planLabel}`)
    }
  })

  it('says "budget" by default in the production-only screens, which call signedPercent directly', () => {
    expect(signedPercent(Infinity)).toBe('above a zero budget')
    expect(signedPercent(-Infinity)).toBe('below a zero budget')
    expect(signedPercent(Infinity, 1, 'target')).toBe('above a zero target')
    expect(signedPercent(3.24)).toBe('+3.2%')
    expect(signedPercent(-6.9)).toBe('-6.9%')
  })
})
