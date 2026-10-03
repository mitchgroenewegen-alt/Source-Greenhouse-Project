import { describe, expect, it } from 'vitest'
import { kpiConfig } from '../../config/kpis'
import { detectFlags } from '../../flags'
import { applyDecisions, buildWeekly, weeklyKey } from '../../scoring/effective'
import { loadTestData } from '../../test/loadData'
import { arcPath, arcPoint, gaugeModel, gaugeValueText } from './gauge'

describe('gauge scale', () => {
  it('runs from 0 to 120 % of the budget: a 4.0 budget gives a 4.8 maximum', () => {
    const m = gaugeModel(2, 4, 1.2)!
    expect(m.scaleMax).toBeCloseTo(4.8, 10)
    expect(m.budget).toBe(4)
  })

  it('takes the range from the KPI setting, so Waste is 120 % and another KPI could be tuned in one line', () => {
    expect(kpiConfig('Waste').gauge).toEqual({ rangeOfBudget: 1.2 })
    expect(gaugeModel(1, 4, 1.5)!.scaleMax).toBeCloseTo(6, 10)
    expect(gaugeModel(1, 4, 1)!.scaleMax).toBe(4)
  })

  it('has no meter on the other Scorecard KPIs until one is added to their line', () => {
    for (const name of ['Harvest', 'Cumulative harvest', 'Fruit weight']) expect(kpiConfig(name).gauge, name).toBeUndefined()
  })
})

describe('gauge fill', () => {
  it('fills the share of the scale the actual reaches', () => {
    expect(gaugeModel(2.4, 4, 1.2)!.fraction).toBeCloseTo(0.5, 10)
    expect(gaugeModel(0, 4, 1.2)!.fraction).toBe(0)
    expect(gaugeModel(4, 4, 1.2)!.fraction).toBeCloseTo(1 / 1.2, 10) // on budget: at the tick
    expect(gaugeModel(2.9, 4, 1.2)!.fraction).toBeCloseTo(2.9 / 4.8, 10)
  })

  it('is full, never more, when the actual reaches the end of the scale', () => {
    const exactly = gaugeModel(4.8, 4, 1.2)!
    expect(exactly.fraction).toBe(1)
    expect(exactly.over).toBe(false)
  })

  it('clamps an actual beyond the scale: full arc, clamped value, and an over-scale flag (AZ-P1-Snack W34: 9.1 vs 4.0)', () => {
    const m = gaugeModel(9.1, 4, 1.2)!
    expect(m.fraction).toBe(1)
    expect(m.clampedActual).toBeCloseTo(4.8, 10)
    expect(m.actual).toBe(9.1) // the real value is kept for the text
    expect(m.over).toBe(true)
  })

  it('holds a negative actual at the start of the scale', () => {
    const m = gaugeModel(-0.3, 4, 1.2)!
    expect(m.fraction).toBe(0)
    expect(m.clampedActual).toBe(0)
    expect(m.over).toBe(false)
  })

  it('does not call 0.6 over a 0.6 maximum when the screen writes both the same way', () => {
    // 0.5 x 1.2 is 0.6 on screen at one decimal; an actual of 0.6049 is shown as 0.6 and must not read "over scale".
    expect(gaugeModel(0.6049, 0.5, 1.2, 1)!.over).toBe(false)
    expect(gaugeModel(0.6049, 0.5, 1.2)!.over).toBe(true) // without decimals the exact numbers decide
    expect(gaugeModel(0.66, 0.5, 1.2, 1)!.over).toBe(true)
  })
})

describe('budget tick', () => {
  it('sits 1/1.2 of the way round the arc, whatever the budget is', () => {
    expect(gaugeModel(2, 4, 1.2)!.budgetFraction).toBeCloseTo(1 / 1.2, 10)
    expect(gaugeModel(2, 0.5, 1.2)!.budgetFraction).toBeCloseTo(1 / 1.2, 10)
    expect(gaugeModel(9, 5, 2)!.budgetFraction).toBe(0.5)
  })

  it('lands 30 degrees below the right-hand end of the arc for a 120 % scale (5/6 of 180 degrees)', () => {
    const { budgetFraction } = gaugeModel(2, 4, 1.2)!
    const p = arcPoint(0, 0, 10, budgetFraction)
    expect(p.x).toBeCloseTo(10 * Math.cos(Math.PI / 6), 8)
    expect(p.y).toBeCloseTo(-10 * Math.sin(Math.PI / 6), 8) // y grows downwards, so above the middle line is negative
  })
})

describe('arc geometry', () => {
  it('puts 0 at the left end, the middle at the top and the full scale at the right end', () => {
    const left = arcPoint(50, 40, 30, 0)
    const top = arcPoint(50, 40, 30, 0.5)
    const right = arcPoint(50, 40, 30, 1)
    expect(left.x).toBeCloseTo(20, 8)
    expect(left.y).toBeCloseTo(40, 8)
    expect(top.x).toBeCloseTo(50, 8)
    expect(top.y).toBeCloseTo(10, 8)
    expect(right.x).toBeCloseTo(80, 8)
    expect(right.y).toBeCloseTo(40, 8)
  })

  it('draws clockwise over the top, and nothing for an empty or backwards span', () => {
    expect(arcPath(50, 40, 30, 0, 1)).toBe('M 20 40 A 30 30 0 0 1 80 40')
    expect(arcPath(50, 40, 30, 0, 0)).toBe('')
    expect(arcPath(50, 40, 30, 0.6, 0.2)).toBe('')
  })
})

describe('no meter when there is nothing to draw', () => {
  it('needs both an actual and a budget', () => {
    expect(gaugeModel(null, 4, 1.2)).toBeNull()
    expect(gaugeModel(3, null, 1.2)).toBeNull()
    expect(gaugeModel(null, null, 1.2)).toBeNull()
  })

  it('needs a budget above zero to make a scale from', () => {
    expect(gaugeModel(3, 0, 1.2)).toBeNull()
    expect(gaugeModel(3, -1, 1.2)).toBeNull()
    expect(gaugeModel(Number.NaN, 4, 1.2)).toBeNull()
    expect(gaugeModel(3, Number.POSITIVE_INFINITY, 1.2)).toBeNull()
  })

  it('needs a range of at least 1, so the budget is on the scale', () => {
    expect(gaugeModel(3, 4, 0.8)).toBeNull()
    expect(gaugeModel(3, 4, 0)).toBeNull()
    expect(gaugeModel(3, 4, Number.NaN)).toBeNull()
  })
})

describe('what a screen reader hears', () => {
  const format = (v: number) => `${v.toFixed(1)}%`
  it('states the real value, the budget and the scale', () => {
    expect(gaugeValueText(gaugeModel(2.9, 4, 1.2)!, format, 'budget')).toBe('2.9%, budget 4.0%, scale 0 to 4.8%.')
  })
  it('says so when the value is beyond the scale, with the real value rather than the clamped one', () => {
    const text = gaugeValueText(gaugeModel(9.1, 4, 1.2)!, format, 'budget')
    expect(text).toContain('9.1%')
    expect(text).toContain('budget 4.0%')
    expect(text).toContain('Off the scale')
  })
})

describe('the Waste meter on the real W34 data', () => {
  const data = loadTestData()
  const weekly = buildWeekly(applyDecisions(data.daily, detectFlags(data.daily, data.cultivations), [], false))
  const waste = kpiConfig('Waste')
  const modelFor = (cultivation: string) => {
    const p = weekly.get(weeklyKey(cultivation, 'Waste', '2025-W34'))
    return gaugeModel(p?.actual ?? null, p?.paired ? p.target : null, waste.gauge!.rangeOfBudget, waste.decimals)
  }

  it('AZ-P1-Snack: 9.1 % against a 4.0 % budget is beyond the 4.8 % scale, so the arc is full and says over scale', () => {
    const m = modelFor('AZ-P1-Snack')!
    expect(m.actual).toBeCloseTo(9.1, 1)
    expect(m.budget).toBeCloseTo(4.0, 1)
    expect(m.scaleMax).toBeCloseTo(4.8, 1)
    expect(m.fraction).toBe(1)
    expect(m.over).toBe(true)
  })

  it('AZ-P2-Snack: 2.9 % against a 4.0 % budget fills about 60 % of the scale and is not over it', () => {
    const m = modelFor('AZ-P2-Snack')!
    expect(m.actual).toBeCloseTo(2.9, 1)
    expect(m.fraction).toBeCloseTo(2.9 / 4.8, 1)
    expect(m.fraction).toBeLessThan(m.budgetFraction) // the fill stops short of the budget tick
    expect(m.over).toBe(false)
  })

  it('has no meter where the week has no budget (PA-P2-TOV) or no actual (PA-P1-TOV)', () => {
    expect(modelFor('PA-P2-TOV')).toBeNull()
    expect(modelFor('PA-P1-TOV')).toBeNull()
  })
})
