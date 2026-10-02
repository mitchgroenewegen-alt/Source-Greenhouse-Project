import { describe, expect, it } from 'vitest'
import { kpiConfig } from '../config/kpis'
import { detectFlags } from '../flags'
import { loadTestData } from '../test/loadData'
import { applyDecisions, buildWeekly } from './effective'
import { attentionKey, badness, compareByAttention, scoreCultivationWeek } from './summary'

const data = loadTestData()
const flags = detectFlags(data.daily, data.cultivations)
const lookup = buildWeekly(applyDecisions(data.daily, flags, [], false))
const W34 = '2025-W34'

describe('category status', () => {
  it('takes the colour of the worst KPI and names it', () => {
    const score = scoreCultivationWeek(lookup, 'AZ-P3-Snack', W34)
    const production = score.categories.find((c) => c.category === 'Production')!
    expect(production.status).toBe('red')
    expect(production.worst?.config.name).toBe('Harvest') // 1.00 vs 1.25 kg/m2, -20%
    const redKpis = score.kpis.filter((k) => k.config.category === 'Production' && k.score.status === 'red')
    expect(redKpis.map((k) => k.config.name)).toContain(production.worst!.config.name)
  })

  it('is never better than any KPI inside it', () => {
    const rank = { green: 0, amber: 1, red: 2 }
    for (const c of data.cultivations) {
      const score = scoreCultivationWeek(lookup, c.id, W34)
      for (const cat of score.categories) {
        const kpis = score.kpis.filter((k) => k.config.category === cat.category && k.score.status)
        const worstRank = Math.max(-1, ...kpis.map((k) => rank[k.score.status!]))
        expect(cat.status ? rank[cat.status] : -1).toBe(worstRank)
      }
    }
  })

  it('leaves a category unscored, not green, when nothing in it can be compared', () => {
    const empty = scoreCultivationWeek(new Map(), 'PA-P1-TOV', W34)
    expect(empty.categories.every((c) => c.status === null)).toBe(true)
  })

  it('picks the KPI furthest into the bad direction among equals', () => {
    expect(badness(kpiConfig('Harvest'), -20)).toBeGreaterThan(badness(kpiConfig('Harvest'), -10))
    expect(badness(kpiConfig('Harvest'), +15)).toBe(0) // beating the budget is not bad
    expect(badness(kpiConfig('Waste'), 40)).toBeGreaterThan(badness(kpiConfig('Waste'), 20))
    expect(badness(kpiConfig('Temperature (24h)'), -3)).toBe(badness(kpiConfig('Temperature (24h)'), 3))
  })
})

describe('worst first', () => {
  it('sorts by red categories, then amber, then cumulative harvest shortfall', () => {
    const scores = data.cultivations.map((c) => scoreCultivationWeek(lookup, c.id, W34)).sort(compareByAttention)
    const keys = scores.map(attentionKey)
    for (let i = 1; i < keys.length; i++) {
      const [a, b] = [keys[i - 1]!, keys[i]!]
      expect(a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] >= b[2])))).toBe(true)
    }
  })
})

describe('every week', () => {
  it('can be scored for every cultivation without errors', () => {
    for (const w of data.weeks) {
      for (const c of data.cultivations) {
        expect(scoreCultivationWeek(lookup, c.id, w.id).kpis).toHaveLength(36)
      }
    }
  })
})
