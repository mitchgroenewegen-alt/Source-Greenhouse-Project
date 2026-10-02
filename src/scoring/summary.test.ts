import { describe, expect, it } from 'vitest'
import { CATEGORY_ROLLUP, kpiConfig } from '../config/kpis'
import { detectFlags } from '../flags'
import { loadTestData } from '../test/loadData'
import { applyDecisions, buildWeekly } from './effective'
import { STATUS_RANK } from './score'
import { attentionKey, badness, compareByAttention, rollupStatus, scoreCultivationWeek } from './summary'

const data = loadTestData()
const flags = detectFlags(data.daily, data.cultivations)
const lookup = buildWeekly(applyDecisions(data.daily, flags, [], false))
const W34 = '2025-W34'

const counts = (green: number, amber: number, red: number) => ({ green, amber, red })

describe('category status (share rule)', () => {
  it('exports the shares the rule uses: red at 1/3 of scored KPIs, green at 2/3', () => {
    expect(CATEGORY_ROLLUP).toEqual({ redShare: 1 / 3, greenShare: 2 / 3 })
  })

  it('is red when at least a third of the scored KPIs are red', () => {
    expect(rollupStatus(counts(0, 0, 1))).toBe('red') // 1 of 1
    expect(rollupStatus(counts(1, 1, 1))).toBe('red') // 1 of 3, exactly a third
    expect(rollupStatus(counts(4, 0, 2))).toBe('red') // 2 of 6, exactly a third, even with 4 green
    expect(rollupStatus(counts(9, 0, 5))).toBe('red') // 5 of 14
    expect(rollupStatus(counts(0, 5, 5))).toBe('red')
  })

  it('is not red below a third: one red among many is amber or green, not red', () => {
    expect(rollupStatus(counts(1, 0, 1))).toBe('red') // 1 of 2 is half
    expect(rollupStatus(counts(4, 2, 1))).toBe('amber') // 1 of 7 red, 4 of 7 green
    expect(rollupStatus(counts(5, 0, 1))).toBe('green') // 1 of 6 red, 5 of 6 green
    expect(rollupStatus(counts(2, 3, 1))).toBe('amber') // 1 of 6 red, 2 of 6 green
  })

  it('is green when at least two thirds are green and fewer than a third are red', () => {
    expect(rollupStatus(counts(2, 1, 0))).toBe('green') // 2 of 3, exactly two thirds
    expect(rollupStatus(counts(4, 2, 0))).toBe('green') // 4 of 6
    expect(rollupStatus(counts(1, 0, 0))).toBe('green') // 1 of 1
    expect(rollupStatus(counts(11, 0, 0))).toBe('green')
    expect(rollupStatus(counts(8, 4, 0))).toBe('green') // 8 of 12
    expect(rollupStatus(counts(7, 4, 1))).toBe('amber') // 7 of 12 is under two thirds, 1 of 12 red
    expect(rollupStatus(counts(8, 1, 1))).toBe('green') // 8 of 10 green, 1 of 10 red
  })

  it('is amber in between', () => {
    expect(rollupStatus(counts(1, 2, 0))).toBe('amber') // 1 of 3 green
    expect(rollupStatus(counts(3, 3, 0))).toBe('amber') // half green
    expect(rollupStatus(counts(0, 4, 0))).toBe('amber')
  })

  it('is unscored, not green, when there is nothing to count', () => {
    expect(rollupStatus(counts(0, 0, 0))).toBeNull()
  })

  it('follows CATEGORY_ROLLUP when other shares are passed in', () => {
    expect(rollupStatus(counts(1, 1, 1), { redShare: 0.5, greenShare: 0.9 })).toBe('amber')
    expect(rollupStatus(counts(1, 1, 1), { redShare: 0.3, greenShare: 0.9 })).toBe('red')
    expect(rollupStatus(counts(2, 1, 0), { redShare: 0.5, greenShare: 0.5 })).toBe('green')
  })
})

describe('category status on real weeks', () => {
  it('rolls up from the counts and still names the worst KPI', () => {
    const score = scoreCultivationWeek(lookup, 'AZ-P3-Snack', W34)
    for (const cat of score.categories) {
      expect(cat.status).toBe(rollupStatus(cat.counts))
      expect(cat.scoredCount).toBe(cat.counts.green + cat.counts.amber + cat.counts.red)
      if (cat.scoredCount > 0) {
        const kpis = score.kpis.filter((k) => k.config.category === cat.category && k.score.status)
        const worstRank = Math.max(...kpis.map((k) => STATUS_RANK[k.score.status!]))
        expect(STATUS_RANK[cat.worst!.score.status!]).toBe(worstRank)
        expect(kpis).toContain(cat.worst)
      } else {
        expect(cat.worst).toBeNull()
      }
    }
  })

  it('names Harvest (1.00 vs 1.25 kg/m2, -20%) as the worst KPI of Production for AZ-P3-Snack in W34', () => {
    const score = scoreCultivationWeek(lookup, 'AZ-P3-Snack', W34)
    const production = score.categories.find((c) => c.category === 'Production')!
    expect(production.worst?.config.name).toBe('Harvest')
    expect(production.worst?.score.status).toBe('red')
  })

  it('can be better than its worst KPI: one red KPI among many greens does not turn the category red', () => {
    let seen = 0
    for (const w of data.weeks) {
      for (const c of data.cultivations) {
        for (const cat of scoreCultivationWeek(lookup, c.id, w.id).categories) {
          if (cat.counts.red === 1 && cat.scoredCount >= 4 && cat.status !== 'red') {
            seen++
            expect(cat.worst?.score.status).toBe('red')
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('leaves a category unscored, not green, when nothing in it can be compared', () => {
    const empty = scoreCultivationWeek(new Map(), 'PA-P1-TOV', W34)
    expect(empty.categories.every((c) => c.status === null)).toBe(true)
  })

  it('picks the KPI furthest into the bad direction among equals', () => {
    expect(badness(kpiConfig('Harvest'), -20)).toBeGreaterThan(badness(kpiConfig('Harvest'), -10))
    expect(badness(kpiConfig('Harvest'), +15)).toBe(0) // beating the budget is not bad
    expect(badness(kpiConfig('Waste'), 1)).toBeGreaterThan(badness(kpiConfig('Waste'), 0.5)) // percentage points
    expect(badness(kpiConfig('Waste'), -1)).toBe(0) // less waste than budgeted is not bad
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
