import { describe, expect, it } from 'vitest'
import { CATEGORY_ORDER, CATEGORY_ROLLUP, kpiConfig } from '../config/kpis'
import type { Category } from '../data/types'
import { detectFlags } from '../flags'
import { loadTestData } from '../test/loadData'
import { applyDecisions, buildWeekly } from './effective'
import { STATUS_RANK, type Status } from './score'
import { attentionKey, badness, compareByAttention, rollupStatus, scoreCultivationWeek, scoreKpiResult, type CultivationScore } from './summary'

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
  type Statuses = Partial<Record<Category, Status | null>>
  /** A made-up week: one status per category, and a cumulative harvest variance. */
  const made = (id: string, statuses: Statuses, cumulative = 0): CultivationScore => ({
    cultivation: id,
    week: W34,
    kpis: [{ config: kpiConfig('Cumulative harvest'), point: undefined, score: { status: null, variance: cumulative }, note: null }],
    categories: CATEGORY_ORDER.map((category) => ({
      category,
      status: statuses[category] ?? 'green',
      worst: null,
      scoredCount: 1,
      counts: { green: 0, amber: 0, red: 0 },
      underReview: 0,
    })),
  })
  const order = (...scores: CultivationScore[]) => [...scores].sort(compareByAttention).map((s) => s.cultivation)

  it('leads with Production: red, then amber, then green, then not scored', () => {
    const red = made('red', { Production: 'red' })
    const amber = made('amber', { Production: 'amber' })
    const green = made('green', { Production: 'green' })
    const none = made('none', { Production: null })
    expect(order(none, green, amber, red)).toEqual(['red', 'amber', 'green', 'none'])
  })

  it('puts a red Production ahead of a green Production whatever the other categories say', () => {
    const productionRed = made('production-red', { Production: 'red' })
    const driversRed = made('drivers-red', { Production: 'green', Plant: 'red', Climate: 'red', Irrigation: 'red', 'Resource usage': 'red' })
    expect(order(driversRed, productionRed)).toEqual(['production-red', 'drivers-red'])
    // and an amber Production beats a green one with four red drivers
    expect(order(driversRed, made('production-amber', { Production: 'amber' }))).toEqual(['production-amber', 'drivers-red'])
  })

  it('breaks a Production tie on red categories among the other four, then amber, then the harvest shortfall', () => {
    const base = { Production: 'amber' } as const
    const twoRed = made('two-red', { ...base, Plant: 'red', Climate: 'red' })
    const oneRedTwoAmber = made('one-red-two-amber', { ...base, Plant: 'red', Climate: 'amber', Irrigation: 'amber' })
    const oneRedOneAmber = made('one-red-one-amber', { ...base, Plant: 'red', Climate: 'amber' })
    expect(order(oneRedOneAmber, oneRedTwoAmber, twoRed)).toEqual(['two-red', 'one-red-two-amber', 'one-red-one-amber'])

    const shortBy10 = made('short-10', base, -10)
    const shortBy3 = made('short-3', base, -3)
    const ahead = made('ahead', base, +5)
    expect(order(ahead, shortBy3, shortBy10)).toEqual(['short-10', 'short-3', 'ahead'])
  })

  it('does not count Production twice: its status is not part of the red and amber counts', () => {
    const [production] = attentionKey(made('a', { Production: 'red' }))
    const [, reds, ambers] = attentionKey(made('a', { Production: 'red' }))
    expect(production).toBe(3)
    expect([reds, ambers]).toEqual([0, 0])
  })

  it('falls back to the cultivation name so the order is stable', () => {
    expect(order(made('B', {}), made('A', {}))).toEqual(['A', 'B'])
  })

  it('on the real W34 data: Production status never improves down the list, and ties follow the other four categories', () => {
    const scores = data.cultivations.map((c) => scoreCultivationWeek(lookup, c.id, W34)).sort(compareByAttention)
    const keys = scores.map(attentionKey)
    for (let i = 1; i < keys.length; i++) {
      const [a, b] = [keys[i - 1]!, keys[i]!]
      expect(a[0]).toBeGreaterThanOrEqual(b[0])
      if (a[0] === b[0]) {
        expect(a[1]).toBeGreaterThanOrEqual(b[1])
        if (a[1] === b[1]) expect(a[2]).toBeGreaterThanOrEqual(b[2])
      }
    }
  })

  it('no longer puts AZ-P2-Snack first at W34: its Production is on track even though four other categories are red', () => {
    const scores = data.cultivations.map((c) => scoreCultivationWeek(lookup, c.id, W34)).sort(compareByAttention)
    const azp2 = scores.find((s) => s.cultivation === 'AZ-P2-Snack')!
    expect(azp2.categories.find((c) => c.category === 'Production')!.status).toBe('green')
    expect(scores[0]!.cultivation).not.toBe('AZ-P2-Snack')
    expect(scores[0]!.categories.find((c) => c.category === 'Production')!.status).toBe('red')
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

describe('scoreKpiResult notes', () => {
  const base = { week: '2025-W34', cultivation: 'AZ-P1-Snack', kpi: 'Head thickness', days: 1, openFlags: 0, decidedFlags: 0, actualMark: null, targetMark: null }

  it('says the actual is missing when the plan value is there but nothing was recorded', () => {
    const result = scoreKpiResult(kpiConfig('Head thickness'), { ...base, actual: null, target: 9, paired: false })
    expect(result.score.status).toBeNull()
    expect(result.note).toBe('no-actual')
  })

  it('says the plan value is missing when only an actual was recorded', () => {
    const result = scoreKpiResult(kpiConfig('Head thickness'), { ...base, actual: 9.4, target: null, paired: false })
    expect(result.note).toBe('no-target')
  })
})
