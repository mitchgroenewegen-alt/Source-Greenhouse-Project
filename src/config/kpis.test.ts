import { describe, expect, it } from 'vitest'
import { detectFlags, fieldWord, groupFlags, ruleTitleFor } from '../flags'
import { directionText, toleranceText } from '../lib/kpiFormat'
import { loadTestData } from '../test/loadData'
import { CATEGORY_ORDER, KPI_CONFIG, kpiConfig, kpisInCategory, planWord, planWordForAll } from './kpis'

/** The rule: Production, Heating energy and LED lighting have a budget; every other KPI has a target. */
const BUDGET_KPIS = ['Harvest', 'Cumulative harvest', 'Fruit weight', 'Waste', 'Heating energy (approx.)', 'LED lighting']

describe('budget or target (planLabel)', () => {
  it('is budget for Production, Heating energy and LED lighting, and target for everything else', () => {
    expect(KPI_CONFIG.filter((k) => k.planLabel === 'budget').map((k) => k.name).sort()).toEqual([...BUDGET_KPIS].sort())
    for (const k of KPI_CONFIG) expect(k.planLabel, k.name).toBe(BUDGET_KPIS.includes(k.name) ? 'budget' : 'target')
  })

  it('makes all of Production budget, and all of Plant, Climate and Irrigation target', () => {
    expect(kpisInCategory('Production').every((k) => k.planLabel === 'budget')).toBe(true)
    for (const category of ['Plant', 'Climate', 'Irrigation'] as const) {
      expect(kpisInCategory(category).every((k) => k.planLabel === 'target'), category).toBe(true)
    }
  })

  it('splits Resources: Irrigation water is a target, Heating energy and LED lighting are budgets', () => {
    expect(kpiConfig('Irrigation water').planLabel).toBe('target')
    expect(kpiConfig('Heating energy (approx.)').planLabel).toBe('budget')
    expect(kpiConfig('LED lighting').planLabel).toBe('budget')
  })

  it('writes the word for one KPI, lower case or capitalised', () => {
    expect(planWord(kpiConfig('Harvest'))).toBe('budget')
    expect(planWord(kpiConfig('Harvest'), { capitalised: true })).toBe('Budget')
    expect(planWord(kpiConfig('Drain pH'))).toBe('target')
    expect(planWord(kpiConfig('Drain pH'), { capitalised: true })).toBe('Target')
  })

  it('writes the word for a table of KPIs: budget, target, or both when they mix', () => {
    expect(planWordForAll(kpisInCategory('Production'))).toBe('budget')
    expect(planWordForAll(kpisInCategory('Plant'))).toBe('target')
    expect(planWordForAll(kpisInCategory('Resource usage'))).toBe('budget or target')
    expect(planWordForAll(kpisInCategory('Resource usage'), { capitalised: true })).toBe('Budget or target')
    expect(CATEGORY_ORDER.map((category) => planWordForAll(kpisInCategory(category)))).toEqual(['budget', 'target', 'target', 'target', 'budget or target'])
  })

  it('follows the config: flipping a KPI to the other word changes what is written', () => {
    expect(planWord({ planLabel: 'target' })).toBe('target')
    expect(planWordForAll([{ planLabel: 'budget' }, { planLabel: 'budget' }])).toBe('budget')
    expect(planWordForAll([])).toBe('target')
  })

  it('names the plan value in the tolerance and direction text of a KPI', () => {
    expect(toleranceText(kpiConfig('Harvest'))).toEqual({
      green: 'no more than 3% below budget (or above it)',
      amber: 'up to 8% below budget',
    })
    expect(toleranceText(kpiConfig('LED lighting')).green).toBe('no more than 10% above budget (or below it)')
    expect(toleranceText(kpiConfig('Fruit weight')).green).toBe('within ±5% of budget')
    expect(toleranceText(kpiConfig('Head thickness')).green).toBe('within ±10% of target')
    expect(toleranceText(kpiConfig('Temperature (24h)'))).toEqual({ green: 'within ±1.5 °C of target', amber: 'within ±3 °C of target' })
    expect(toleranceText(kpiConfig('Irrigation water')).amber).toBe('within ±20% of target')
    expect(directionText(kpiConfig('Fruit weight'))).toBe('Close to budget is best')
    expect(directionText(kpiConfig('Drain EC'))).toBe('Close to target is best')
    expect(directionText(kpiConfig('Harvest'))).toBe('Higher is better')
  })

  it('never says "budget" for a target KPI or "target" for a budget KPI in its tolerance text', () => {
    for (const k of KPI_CONFIG) {
      const { green, amber } = toleranceText(k)
      const text = `${green} ${amber} ${directionText(k)}`
      expect(text, k.name).toContain(k.planLabel)
      expect(text, k.name).not.toContain(k.planLabel === 'budget' ? 'target' : 'budget')
    }
  })
})

describe('budget or target in the data checks', () => {
  it('names a flagged column by the KPI\'s word, and the actual column "actual"', () => {
    expect(fieldWord('target', 'Harvest')).toBe('budget')
    expect(fieldWord('target', 'Temperature (24h)')).toBe('target')
    expect(fieldWord('target', 'Temperature (24h)', { capitalised: true })).toBe('Target')
    expect(fieldWord('actual', 'Harvest')).toBe('actual')
    expect(fieldWord('actual', 'Harvest', { capitalised: true })).toBe('Actual')
  })

  it('falls back to "target" for a KPI that is not configured (an imported decision for a KPI that is gone)', () => {
    expect(fieldWord('target', 'No such KPI')).toBe('target')
  })

  it('titles the far-apart rule with the KPI\'s word', () => {
    expect(ruleTitleFor('target-actual-apart', 'LED lighting')).toBe('Budget and actual far apart')
    expect(ruleTitleFor('target-actual-apart', 'Drain')).toBe('Target and actual far apart')
    expect(ruleTitleFor('missing-value', 'Drain')).toBe('Missing value')
  })

  it('writes the explanations of the real flags with the right word', () => {
    const data = loadTestData()
    const groups = groupFlags(detectFlags(data.daily, data.cultivations), data.daily)
    const targetGroups = groups.filter((g) => g.field === 'target')
    expect(targetGroups.length).toBeGreaterThan(0)
    for (const g of targetGroups) {
      const wrong = kpiConfig(g.kpi).planLabel === 'budget' ? /\btargets?\b/i : /\bbudgets?\b/i
      expect(g.explanation, `${g.cultivation} ${g.kpi}`).not.toMatch(wrong)
    }
  })
})
