import { describe, expect, it } from 'vitest'
import { KPI_CONFIG, kpiConfig } from '../config/kpis'
import { loadTestData } from '../test/loadData'
import { scoreKpi, worstStatus } from './score'

const data = loadTestData()

describe('scoring checks against the real data', () => {
  it('scores AZ-P3-Snack W34 Harvest (1.00 vs 1.25 kg/m2, -20%) red', () => {
    const w = data.weekly.find((r) => r.cultivation === 'AZ-P3-Snack' && r.kpi === 'Harvest' && r.week === '2025-W34')!
    expect(w.actual).toBeCloseTo(1.0, 2)
    expect(w.target).toBeCloseTo(1.25, 2)
    const score = scoreKpi('Harvest', w.actual, w.target)
    expect(score.variance).toBeCloseTo(-20, 0)
    expect(score.status).toBe('red')
  })

  it('scores ON-P1-Cherry cumulative harvest on 24 Aug (6.89 vs 7.40, -6.9%) amber', () => {
    const row = data.daily.find(
      (r) => r.cultivation === 'ON-P1-Cherry' && r.kpi === 'Cumulative harvest' && r.date === '2025-08-24',
    )!
    expect([row.actual, row.target]).toEqual([6.89, 7.4])
    const score = scoreKpi('Cumulative harvest', row.actual, row.target)
    expect(score.variance).toBeCloseTo(-6.9, 1)
    expect(score.status).toBe('amber')
  })
})

describe('higher is better (Harvest, Cumulative harvest)', () => {
  it('is green down to -3%, amber down to -8%, red below', () => {
    expect(scoreKpi('Harvest', 100, 100).status).toBe('green')
    expect(scoreKpi('Harvest', 97, 100).status).toBe('green') // exactly -3%
    expect(scoreKpi('Harvest', 96.9, 100).status).toBe('amber')
    expect(scoreKpi('Harvest', 92, 100).status).toBe('amber') // exactly -8%
    expect(scoreKpi('Harvest', 91.9, 100).status).toBe('red')
  })

  it('never punishes beating the target', () => {
    expect(scoreKpi('Cumulative harvest', 150, 100).status).toBe('green')
  })
})

describe('lower is better (Waste, Heating energy, LED lighting)', () => {
  it('is green up to +5%, amber up to +15%, red above', () => {
    for (const kpi of ['Waste', 'Heating energy (approx.)', 'LED lighting']) {
      expect(scoreKpi(kpi, 105, 100).status).toBe('green')
      expect(scoreKpi(kpi, 105.1, 100).status).toBe('amber')
      expect(scoreKpi(kpi, 115, 100).status).toBe('amber')
      expect(scoreKpi(kpi, 115.1, 100).status).toBe('red')
      expect(scoreKpi(kpi, 50, 100).status).toBe('green') // using less is fine
    }
  })
})

describe('close to target (everything else with a target)', () => {
  it('is green within 5% and amber within 10%, on either side', () => {
    expect(scoreKpi('Fruit weight', 105, 100).status).toBe('green')
    expect(scoreKpi('Fruit weight', 95, 100).status).toBe('green')
    expect(scoreKpi('Fruit weight', 90, 100).status).toBe('amber')
    expect(scoreKpi('Fruit weight', 110, 100).status).toBe('amber')
    expect(scoreKpi('Fruit weight', 89, 100).status).toBe('red')
    expect(scoreKpi('Fruit weight', 111, 100).status).toBe('red')
  })

  it('scores temperatures in absolute degrees: green within 1, amber within 2', () => {
    for (const kpi of ['Temperature (24h)', 'Temperature (day)', 'Temperature (night)', 'Day/night temperature difference']) {
      expect(scoreKpi(kpi, 21, 20).status).toBe('green')
      expect(scoreKpi(kpi, 19, 20).status).toBe('green') // exactly 1 below
      expect(scoreKpi(kpi, 18.5, 20).status).toBe('amber')
      expect(scoreKpi(kpi, 22, 20).status).toBe('amber') // exactly 2 above
      expect(scoreKpi(kpi, 22.1, 20).status).toBe('red')
      expect(scoreKpi(kpi, 17.9, 20).status).toBe('red')
    }
    expect(scoreKpi('Temperature (24h)', 21.5, 20).variance).toBeCloseTo(1.5)
  })

  it('scores index KPIs in absolute points against a plan of 0', () => {
    expect(scoreKpi('Plant balance factor', 0.2, 0).status).toBe('green')
    expect(scoreKpi('Plant balance factor', -0.4, 0).status).toBe('amber')
    expect(scoreKpi('Plant balance factor', 0.9, 0).status).toBe('red')
    expect(scoreKpi('Generative trend indicator', 0.1, 0).status).toBe('green')
    expect(scoreKpi('Generative trend indicator', -0.45, 0).status).toBe('red')
  })
})

describe('what is not scored', () => {
  it('does not score a KPI without a target, or without an actual', () => {
    expect(scoreKpi('Solar radiation', 2000, null)).toEqual({ status: null, variance: null, reason: 'no-target' })
    expect(scoreKpi('Harvest', null, 1)).toEqual({ status: null, variance: null, reason: 'no-actual' })
  })

  it('handles a target of 0 without dividing by zero', () => {
    expect(scoreKpi('LED lighting', 0, 0).status).toBe('green')
    expect(scoreKpi('LED lighting', 3, 0).status).toBe('red') // used light that was not budgeted
    expect(scoreKpi('Harvest', 0.4, 0).status).toBe('green')
  })

  it('picks the worst of several statuses and ignores unscored ones', () => {
    expect(worstStatus('green', 'amber')).toBe('amber')
    expect(worstStatus('red', 'amber')).toBe('red')
    expect(worstStatus(null, 'green')).toBe('green')
    expect(worstStatus(null, null)).toBeNull()
  })
})

describe('the KPI config', () => {
  it('has one entry for each of the 36 KPIs and agrees with the workbook dictionary', () => {
    expect(KPI_CONFIG).toHaveLength(36)
    for (const entry of data.kpis) {
      const config = kpiConfig(entry.name)
      expect(config.category, entry.name).toBe(entry.category)
      expect(config.unit, entry.name).toBe(entry.unit)
      expect(config.aggregation, entry.name).toBe(entry.aggregation)
    }
  })

  it('uses the starting thresholds from the brief', () => {
    const t = (n: string) => {
      const c = kpiConfig(n)
      return [c.direction, c.variance, c.green, c.amber]
    }
    expect(t('Harvest')).toEqual(['higher', 'percent', 3, 8])
    expect(t('Cumulative harvest')).toEqual(['higher', 'percent', 3, 8])
    for (const n of ['Waste', 'Heating energy (approx.)', 'LED lighting']) expect(t(n)).toEqual(['lower', 'percent', 5, 15])
    expect(t('Temperature (24h)')).toEqual(['target', 'absolute', 1, 2])
    expect(t('Drain pH')).toEqual(['target', 'percent', 5, 10])
  })

  it('shows exactly cumulative harvest, harvest, fruit weight and waste on the scorecard', () => {
    expect(KPI_CONFIG.filter((k) => k.showOnScorecard).map((k) => k.name).sort()).toEqual(
      ['Cumulative harvest', 'Fruit weight', 'Harvest', 'Waste'],
    )
  })
})
