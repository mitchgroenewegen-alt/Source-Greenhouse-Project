import { describe, expect, it } from 'vitest'
import { detectFlags } from '../flags'
import type { Decision } from '../storage/types'
import { loadTestData } from '../test/loadData'
import { applyDecisions, buildWeekly, weeklyKey } from './effective'
import { scoreCultivationWeek } from './summary'

const data = loadTestData()
const flags = detectFlags(data.daily, data.cultivations)

const TEMP = 'Temperature (24h)'
const tempFlags = flags.filter((f) => f.cultivation === 'PA-P2-TOV' && f.kpi === TEMP && f.field === 'target')

function decide(kind: Decision['kind'], correctedValue: number | null = null): Decision[] {
  return tempFlags.map((f) => ({
    cellId: f.id,
    cultivation: f.cultivation,
    kpi: f.kpi,
    date: f.date,
    field: f.field,
    rule: f.rule,
    originalValue: f.value,
    kind,
    correctedValue,
    decidedBy: 'Test',
    decidedAt: '2025-09-01T10:00:00Z',
    note: '',
  }))
}

const week = (decisions: Decision[], rawMode: boolean, w: string) =>
  buildWeekly(applyDecisions(data.daily, flags, decisions, rawMode)).get(weeklyKey('PA-P2-TOV', TEMP, w))!

describe('which values reach the scores', () => {
  it('leaves a flagged value out until someone decides', () => {
    const w28 = week([], false, '2025-W28') // 7-13 July: every target day is 69
    expect(w28.target).toBeNull()
    expect(w28.paired).toBe(false)
    expect(w28.openFlags).toBe(7)
    expect(w28.actual).not.toBeNull() // the measurement itself is still shown
  })

  it('does not score the week while its target is under review, and says why', () => {
    const lookup = buildWeekly(applyDecisions(data.daily, flags, [], false))
    const result = scoreCultivationWeek(lookup, 'PA-P2-TOV', '2025-W28').kpis.find((k) => k.config.name === TEMP)!
    expect(result.score.status).toBeNull()
    expect(result.note).toBe('under-review')
  })

  it('uses the corrected value once corrected', () => {
    const w28 = week(decide('correct', 20.6), false, '2025-W28')
    expect(w28.target).toBe(20.6)
    expect(w28.paired).toBe(true)
    expect(w28.openFlags).toBe(0)
    expect(w28.decidedFlags).toBe(7)
  })

  it('uses the recorded value when confirmed, and leaves it out when excluded', () => {
    expect(week(decide('confirm'), false, '2025-W28').target).toBe(69)
    expect(week(decide('exclude'), false, '2025-W28').target).toBeNull()
  })

  it('with "show raw data" uses the recorded value whatever the flags or decisions say', () => {
    expect(week([], true, '2025-W28').target).toBe(69)
    expect(week(decide('correct', 20.6), true, '2025-W28').target).toBe(69)
  })

  it('scores red on the raw 69 and on the corrected value according to the real gap', () => {
    const rawLookup = buildWeekly(applyDecisions(data.daily, flags, [], true))
    const raw = scoreCultivationWeek(rawLookup, 'PA-P2-TOV', '2025-W28').kpis.find((k) => k.config.name === TEMP)!
    expect(raw.score.status).toBe('red')
    expect(raw.score.variance).toBeLessThan(-40)
    const fixedLookup = buildWeekly(applyDecisions(data.daily, flags, decide('correct', 20.6), false))
    const fixed = scoreCultivationWeek(fixedLookup, 'PA-P2-TOV', '2025-W28').kpis.find((k) => k.config.name === TEMP)!
    expect(Math.abs(fixed.score.variance!)).toBeLessThan(3)
  })

  it('marks weeks without flagged cells as untouched', () => {
    const w22 = week([], false, '2025-W22')
    expect([w22.openFlags, w22.decidedFlags]).toEqual([0, 0])
  })
})

describe('weekly roll-up in the app matches the prepared file', () => {
  it('gives the same numbers as data.json weekly rows when nothing is filtered (raw mode)', () => {
    const lookup = buildWeekly(applyDecisions(data.daily, flags, [], true))
    expect(lookup.size).toBe(data.weekly.length)
    for (const row of data.weekly) {
      const point = lookup.get(weeklyKey(row.cultivation, row.kpi, row.week))!
      expect(point.actual).toBe(row.actual)
      expect(point.target).toBe(row.target)
      expect(point.days).toBe(row.days)
    }
  })
})
