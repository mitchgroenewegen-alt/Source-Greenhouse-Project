import { describe, expect, it } from 'vitest'
import { kpiConfig } from '../config/kpis'
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
