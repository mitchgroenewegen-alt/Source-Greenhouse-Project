import { describe, expect, it } from 'vitest'
import { isoToExcelSerial, excelSerialToIso, weekStartOf } from '../data/dates'
import { precheckValues } from '../editing/precheck'
import { latestWeekWithActuals } from '../setup/dataState'
import { loadTestData } from '../test/loadData'
import { merge } from '../workspace/merge'
import type { EnteredRow } from '../workspace/types'
import { dayLookup, toEnteredRows } from './entries'
import { kgToKgPerM2 } from './harvest'
import { previousWeek, registrationDate, registrationWeekday, weekChoices } from './registration'

const base = loadTestData()
const PA = 'PA-P1-TOV'
const meta = { createdBy: 'dana@example.com', createdAt: '2025-09-01T10:00:00.000Z', source: 'entered' as const }

describe('kg to kg/m²', () => {
  it('divides the total by the growing area', () => {
    expect(kgToKgPerM2(98_400, 98_400)).toBe(1)
    expect(kgToKgPerM2(7_000, 98_400)).toBeCloseTo(0.071138, 6)
  })

  it('has no answer without a usable area or a number', () => {
    expect(kgToKgPerM2(500, 0)).toBeNull()
    expect(kgToKgPerM2(500, -3)).toBeNull()
    expect(kgToKgPerM2(NaN, 100)).toBeNull()
  })
})

describe('dates for entries', () => {
  it('finds the Monday of an ISO week', () => {
    expect(weekStartOf('2025-W34')).toBe('2025-08-18')
    expect(weekStartOf('2025-W35')).toBe('2025-08-25')
    expect(weekStartOf('2026-W01')).toBe('2025-12-29')
  })

  it('turns a date into an Excel serial and back', () => {
    expect(isoToExcelSerial('2025-05-26')).toBe(45803)
    expect(excelSerialToIso(isoToExcelSerial('2024-02-29'))).toBe('2024-02-29')
  })

  it('offers the weeks after the last one, so the next week can be registered', () => {
    const choices = weekChoices(base.weeks)
    expect(choices.slice(base.weeks.length)[0]).toEqual({ id: '2025-W35', start: '2025-08-25', end: '2025-08-31' })
    expect(previousWeek('2025-W35')).toBe('2025-W34')
  })
})

describe('the day a weekly registration is saved on', () => {
  it('is the Monday for the Plant KPIs, which the data registers on Mondays', () => {
    const weekday = registrationWeekday(base.daily, PA, 'Head thickness')
    expect(weekday).toBe(0)
    expect(registrationDate('2025-W35', weekday)).toBe('2025-08-25')
  })

  it('is the Sunday for Waste, which the data registers on the last day of the week', () => {
    const weekday = registrationWeekday(base.daily, PA, 'Waste')
    expect(weekday).toBe(6)
    expect(registrationDate('2025-W35', weekday)).toBe('2025-08-31')
  })

  it('is the Monday for a KPI recorded on every day', () => {
    expect(registrationWeekday(base.daily, PA, 'Temperature (24h)')).toBe(0)
  })

  it('follows the other cultivations when this one has no values yet, and the Monday when nobody has', () => {
    expect(registrationWeekday(base.daily, 'NEW-CULTIVATION', 'Waste')).toBe(6)
    expect(registrationWeekday([], PA, 'Waste')).toBe(0)
  })

  it('follows a cultivation that registers a KPI on another weekday', () => {
    const wednesdays = ['2025-08-06', '2025-08-13', '2025-08-20'].map((date) => ({ date, week: '', cultivation: PA, kpi: 'Leaf length', actual: 1, target: 1 }))
    expect(registrationWeekday(wednesdays, PA, 'Leaf length')).toBe(2)
    expect(registrationDate('2025-W35', 2)).toBe('2025-08-27')
  })
})

describe('entered rows', () => {
  it('keep the target the day already has when only an actual is typed', () => {
    const before = dayLookup(base.daily)
    const day = base.daily.find((r) => r.cultivation === PA && r.kpi === 'Harvest' && r.date === '2025-08-18')!
    const [row] = toEnteredRows([{ cultivation: PA, kpi: 'Harvest', date: '2025-08-18', actual: 0.5 }], before, meta)
    expect(row).toMatchObject({ actual: 0.5, target: day.target, source: 'entered', createdBy: 'dana@example.com' })
  })

  it('leave the other column empty on a day that has no row', () => {
    const [row] = toEnteredRows([{ cultivation: PA, kpi: 'Harvest', date: '2025-08-25', actual: 0.5 }], dayLookup(base.daily), meta)
    expect(row).toMatchObject({ actual: 0.5, target: null })
  })

  it('make an entry after the last data week the default week', () => {
    expect(latestWeekWithActuals(base.daily, base.weeks)).toBe('2025-W34')
    const entered: EnteredRow = { cultivation: PA, date: '2025-08-25', kpi: 'Harvest', actual: 0.7, target: null, ...meta }
    const merged = merge(base, { enteredRows: [entered] })
    expect(merged.weeks[merged.weeks.length - 1]!.id).toBe('2025-W35')
    expect(latestWeekWithActuals(merged.daily, merged.weeks)).toBe('2025-W35')
  })
})

describe('the data checks on a typed value', () => {
  const cultivation = base.cultivations.find((c) => c.id === 'PA-P2-TOV')!
  const series = base.daily.filter((r) => r.cultivation === cultivation.id && r.kpi === 'Temperature (24h)')

  it('catch a Fahrenheit actual and suggest the Celsius value', () => {
    const result = precheckValues(series, cultivation, 'Temperature (24h)', [{ date: '2025-08-25', actual: 69 }])
    expect(result.concerns.map((c) => c.rule)).toEqual(['unit-fahrenheit'])
    expect(result.suggested).toHaveLength(1)
    expect(result.suggested![0]!.actual).toBeCloseTo(20.6, 1)
  })

  it('catch it on a day that already has a row too', () => {
    const result = precheckValues(series, cultivation, 'Temperature (24h)', [{ date: '2025-08-18', actual: 69 }])
    expect(result.concerns).toHaveLength(1)
  })

  it('say nothing about a plausible actual', () => {
    const result = precheckValues(series, cultivation, 'Temperature (24h)', [{ date: '2025-08-25', actual: 21 }])
    expect(result).toEqual({ concerns: [], suggested: null })
  })

  it('still check a typed target', () => {
    const result = precheckValues(series, cultivation, 'Temperature (24h)', [{ date: '2025-08-18', target: 69 }])
    expect(result.concerns.length).toBeGreaterThan(0)
  })

  it('do not blame a day for a value that was not typed', () => {
    // The Fahrenheit slip is in the series already; typing a sound actual on another day does not report it.
    const dirty = series.map((r) => (r.date === '2025-08-19' ? { ...r, actual: 69 } : r))
    expect(precheckValues(dirty, cultivation, 'Temperature (24h)', [{ date: '2025-08-25', actual: 21 }]).concerns).toEqual([])
  })
})
