import { describe, expect, it } from 'vitest'
import type { Cultivation } from '../../data/types'
import type { WeeklyPoint } from '../../scoring/effective'
import { facilityTotal, harvestRow, toTonnes } from './facilityTotals'

const c = (id: string, areaM2: number): Cultivation => ({ id, facility: 'F', greenhouse: 'P1', crop: 'Tomato', variety: 'V', plantingDate: '2025-01-01', areaM2, cropWeekAtEnd: 1 })
const p = (actual: number | null, target: number | null): WeeklyPoint => ({
  week: '2025-W34', cultivation: 'x', kpi: 'Harvest', actual, target, days: 7, paired: actual !== null && target !== null,
  openFlags: 0, decidedFlags: 0, actualMark: null, targetMark: null,
})

describe('facility harvest totals', () => {
  it('turns kg/m2 and area into tonnes', () => {
    expect(toTonnes(2.5, 98400)).toBeCloseTo(246)
    expect(toTonnes(1, 1000)).toBe(1)
  })

  it('weights by growing area, not by cultivation', () => {
    const rows = [harvestRow(c('A', 10000), p(2, 2), 'week'), harvestRow(c('B', 30000), p(1, 2), 'week')]
    const total = facilityTotal(rows, 'week')
    expect(total.areaM2).toBe(40000)
    expect(total.actual).toBeCloseTo(1.25) // (2*10000 + 1*30000) / 40000
    expect(total.budget).toBeCloseTo(2)
    expect(total.variance).toBeCloseTo(-37.5)
    expect(total.status).toBe('red')
    // tonnes add up: 20 t + 30 t = 50 t actual, 80 t budget
    expect(toTonnes(total.actual!, total.areaM2)).toBeCloseTo(50)
    expect(toTonnes(total.budget!, total.areaM2)).toBeCloseTo(80)
  })

  it('leaves a cultivation out of both sides when it has no comparable week', () => {
    const rows = [harvestRow(c('A', 10000), p(2, 2), 'week'), harvestRow(c('B', 30000), p(null, 2), 'week')]
    const total = facilityTotal(rows, 'week')
    expect(total.areaM2).toBe(10000)
    expect(total.actual).toBe(2)
    expect(total.status).toBe('green')
  })

  it('has no total when nothing can be compared', () => {
    expect(facilityTotal([harvestRow(c('A', 10000), undefined, 'week')], 'week')).toEqual({ areaM2: 0, actual: null, budget: null, variance: null, status: null })
  })
})
