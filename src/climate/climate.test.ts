import { describe, expect, it } from 'vitest'
import { readTableFile } from '../exchange/file'
import { writeWorkbook } from '../exchange/xlsxFile'
import { cellId, detectFlags } from '../flags'
import { scoreKpi } from '../scoring/score'
import { applyDecisions } from '../scoring/effective'
import type { Decision } from '../storage/types'
import { loadTestData } from '../test/loadData'
import type { ClimateReading } from '../workspace/types'
import { addDays } from '../data/dates'
import { daySeries, hourOf, readingDays } from './day24'
import { dayLabel, dayTable, daysBetween, kpiSeries, periodOf } from './days'
import { CLIMATE_TABLE, MAX_CLIMATE_ROWS, parseClimateTable, previewClimateImport, readTimestamp, toClimateReadings } from './import'
import { CLIMATE_KPIS, RADIATION, RTR, T_24H, T_DAY, T_DIFF, T_NIGHT } from './kpis'
import { differs, overlaySeries, overlayShare, overlayShareAll, sharedGreenhouse } from './peers'
import { differenceSeries, lightHoursSeries, lightTemperatureSeries, rtrTemperature } from './series'
import { countKinds, dayVerdict } from './status'

const base = loadTestData()
const flags = detectFlags(base.daily, base.cultivations)
const effective = (decisions: Decision[] = [], raw = false) => applyDecisions(base.daily, flags, decisions, raw)
const TOV = 'PA-P2-TOV'
const decision = (date: string, kind: Decision['kind'], correctedValue: number | null = null): Decision => ({
  cellId: cellId(TOV, T_24H, date, 'target'), cultivation: TOV, kpi: T_24H, date, field: 'target', rule: 'unit-fahrenheit', originalValue: 69,
  kind, correctedValue, decidedBy: 'Dana', decidedAt: '2025-09-01T10:00:00.000Z', note: '',
})
const flaggedDays = flags.filter((f) => f.cultivation === TOV && f.kpi === T_24H && f.field === 'target' && f.rule === 'unit-fahrenheit').map((f) => f.date)

describe('days and labels', () => {
  it('lists every date between two days and labels them for a week or a longer view', () => {
    expect(daysBetween('2025-08-18', '2025-08-24')).toHaveLength(7)
    expect(dayLabel('2025-08-18', true)).toBe('Mon 18')
    expect(dayLabel('2025-08-18', false)).toBe('18 Aug')
    expect(periodOf(dayTable(effective(), TOV))).toEqual({ start: '2025-05-26', end: '2025-08-24' })
    expect(periodOf(new Map())).toBeNull()
  })
})

describe('day/night difference', () => {
  it('uses the recorded KPI, and works it out from day and night where the KPI has no value', () => {
    const table = dayTable(effective(), 'ON-P1-Cherry')
    const dates = daysBetween('2025-06-15', '2025-06-18')
    const diff = differenceSeries(table, dates, true)
    const recorded = table.get(T_DIFF)!.get('2025-06-16')!
    expect(diff[1]!.actual).toBe(recorded.actual)
    expect(diff[1]!.target).toBe(4.5)

    // Take the recorded difference away for one day: it comes back as day minus night.
    const day = table.get(T_DAY)!.get('2025-06-16')!
    const night = table.get(T_NIGHT)!.get('2025-06-16')!
    const gone = new Map(table)
    gone.set(T_DIFF, new Map([...table.get(T_DIFF)!].filter(([d]) => d !== '2025-06-16')))
    const derived = differenceSeries(gone, dates, true)[1]!
    expect(derived.actual).toBeCloseTo(day.actual! - night.actual!, 2)
    expect(derived.target).toBeCloseTo(day.target! - night.target!, 2)
  })

  it('stays empty when a temperature is missing too', () => {
    const table = dayTable([], 'x')
    expect(differenceSeries(table, ['2025-06-16'], true)[0]).toMatchObject({ actual: null, target: null })
  })
})

describe('the RTR target line', () => {
  it('is the RTR target times the day\'s radiation, and empty without either', () => {
    expect(rtrTemperature(0.012, 1650)).toBe(19.8)
    expect(rtrTemperature(null, 1650)).toBeNull()
    expect(rtrTemperature(0.012, null)).toBeNull()
  })

  it('has a line for a cultivation with an RTR target and none for one without (Ontario has no RTR target)', () => {
    const rows = effective()
    const pa = lightTemperatureSeries(dayTable(rows, TOV), ['2025-06-16'], true)[0]!
    expect(pa.rtrTarget).toBe(0.012)
    expect(pa.radiation).toBe(1650)
    expect(pa.rtrTemperature).toBe(19.8)
    expect(pa.temperature).toBe(19.51)
    const on = lightTemperatureSeries(dayTable(rows, 'ON-P1-Cherry'), ['2025-06-16'], true)[0]!
    expect(on.rtrTarget).toBeNull()
    expect(on.rtrTemperature).toBeNull()
    expect(on.radiation).toBe(2782)
  })

  it('puts PAR next to LED hours, and PAR is empty where a cultivation has none', () => {
    const rows = effective()
    const pa = lightHoursSeries(dayTable(rows, TOV), ['2025-06-18'], true)[0]!
    expect(pa).toMatchObject({ par: 17.13, parTarget: 32, ledHours: 10.09 })
    const on = lightHoursSeries(dayTable(rows, 'ON-P1-Cherry'), ['2025-06-18'], true)[0]!
    expect(on.par).toBeNull()
  })
})

describe('day status', () => {
  it('has 21 days with the 69 target, all flagged by the data checks', () => {
    expect(flaggedDays).toHaveLength(21)
  })

  it('shows those days as flagged, not red, until somebody decides', () => {
    const table = dayTable(effective(), TOV)
    for (const date of flaggedDays) {
      const verdict = dayVerdict(T_24H, table.get(T_24H)!.get(date))
      expect(verdict.kind, date).toBe('flagged')
      expect(verdict.open).toBe(true)
      expect(verdict.reason).toMatch(/target is flagged/)
    }
    // The days around them are scored as usual.
    const normal = [...table.get(T_24H)!.keys()].filter((d) => !flaggedDays.includes(d))
    expect(normal.some((d) => dayVerdict(T_24H, table.get(T_24H)!.get(d)).kind === 'red')).toBe(true)
    expect(normal.every((d) => dayVerdict(T_24H, table.get(T_24H)!.get(d)).kind !== 'flagged')).toBe(true)
  })

  it('goes back to a status once the check is resolved: confirmed is red, corrected is scored on the corrected target, excluded is no data', () => {
    const date = flaggedDays[0]!
    const cell = (decisions: Decision[], raw = false) => dayTable(effective(decisions, raw), TOV).get(T_24H)!.get(date)
    expect(dayVerdict(T_24H, cell([decision(date, 'confirm')]))).toMatchObject({ kind: 'red', checked: true, open: false })
    const corrected = dayVerdict(T_24H, cell([decision(date, 'correct', 20.6)]))
    const actual = cell([decision(date, 'correct', 20.6)])!.actual!
    expect(corrected.kind).toBe(scoreKpi(T_24H, actual, 20.6).status) // scored on the corrected target, not on 69
    expect(corrected.checked).toBe(true)
    expect(dayVerdict(T_24H, cell([decision(date, 'exclude')]))).toMatchObject({ kind: 'none', checked: true })
  })

  it('with Show raw data on, scores the recorded 69 (red) and still says it is flagged', () => {
    const date = flaggedDays[0]!
    const verdict = dayVerdict(T_24H, dayTable(effective([], true), TOV).get(T_24H)!.get(date), { raw: true })
    expect(verdict.kind).toBe('red')
    expect(verdict.open).toBe(true)
    expect(verdict.reason).toMatch(/Show raw data/)
  })

  it('has no data for a missing day or value, and no status without a target', () => {
    expect(dayVerdict(T_24H, undefined).kind).toBe('none')
    const on = dayTable(effective(), 'ON-P1-Cherry')
    expect(dayVerdict(RTR, on.get(RTR)!.get('2025-06-16')).kind).toBe('none') // an actual but no target
    expect(dayVerdict(RADIATION, on.get(RADIATION)!.get('2025-06-16')).reason).toMatch(/no target/)
  })

  it('counts the kinds of a strip', () => {
    const table = dayTable(effective(), TOV)
    const dates = daysBetween('2025-05-26', '2025-08-24')
    const counts = countKinds(kpiSeries(table, T_24H, dates, false).map((_, i) => dayVerdict(T_24H, table.get(T_24H)!.get(dates[i]!))))
    expect(counts.flagged).toBe(21)
    expect(counts.green + counts.amber + counts.red + counts.flagged + counts.none).toBe(dates.length)
  })

  it('has a strip row for every climate KPI', () => {
    expect(CLIMATE_KPIS.map((k) => k.name)).toContain(T_24H)
    expect(CLIMATE_KPIS.every((k) => k.category === 'Climate' && k.planLabel === 'target')).toBe(true)
    expect(CLIMATE_KPIS).toHaveLength(10)
  })
})

describe('cultivations that share a greenhouse', () => {
  const cultivations = base.cultivations
  it('pairs Ontario\'s Cherry and TOV, in both directions', () => {
    expect(sharedGreenhouse('ON-P1-Cherry', cultivations).map((c) => c.id)).toEqual(['ON-P1-TOV'])
    expect(sharedGreenhouse('ON-P1-TOV', cultivations).map((c) => c.id)).toEqual(['ON-P1-Cherry'])
  })
  it('gives the other cultivations no partner, and skips archived ones and other facilities', () => {
    expect(sharedGreenhouse('PA-P1-TOV', cultivations)).toEqual([])
    expect(sharedGreenhouse('nope', cultivations)).toEqual([])
    const archived = cultivations.map((c) => (c.id === 'ON-P1-TOV' ? { ...c, archived: true } : c))
    expect(sharedGreenhouse('ON-P1-Cherry', archived)).toEqual([])
    const third = { ...cultivations.find((c) => c.id === 'ON-P1-TOV')!, id: 'ON-P1-Plum', variety: 'Plum' }
    expect(sharedGreenhouse('ON-P1-Cherry', [...cultivations, third]).map((c) => c.id)).toEqual(['ON-P1-TOV', 'ON-P1-Plum'])
    const otherFacility = { ...third, facility: 'Arizona' }
    expect(sharedGreenhouse('ON-P1-Cherry', [...cultivations, otherFacility]).map((c) => c.id)).toEqual(['ON-P1-TOV'])
  })

  it('counts the days they differ by more than the green tolerance', () => {
    expect(differs(T_24H, 20, 21.4)).toBe(false) // within 1.5 degrees
    expect(differs(T_24H, 20, 21.6)).toBe(true)
    expect(differs('CO2 (day)', 500, 540)).toBe(false) // 7.4 % of the larger, within 10 %
    expect(differs('CO2 (day)', 500, 600)).toBe(true)
    expect(differs(T_24H, null, 21.6)).toBe(false)
    const rows = effective()
    const a = dayTable(rows, 'ON-P1-Cherry')
    const b = dayTable(rows, 'ON-P1-TOV')
    const dates = daysBetween('2025-05-26', '2025-08-24')
    const one = overlayShare(T_24H, a, b, dates)
    expect(one.compared).toBeGreaterThan(80)
    expect(one.different).toBeGreaterThan(80)
    expect(one.beyondTolerance).toBeLessThanOrEqual(one.different)
    // Solar radiation is measured outside: the two cultivations read the same on every day.
    expect(overlayShare(RADIATION, a, b, dates)).toEqual({ compared: 91, different: 0, beyondTolerance: 0 })
    // Across the climate KPIs, the two differ in most of the comparisons (86 % in the workbook's data).
    const all = overlayShareAll(a, b, dates)
    expect(Math.round((all.different / all.compared) * 100)).toBe(86)
    expect(overlaySeries(T_24H, a, b, dates.slice(0, 2), (d) => d)).toHaveLength(2)
  })
})

describe('reading a timestamp', () => {
  it('reads text with a space or a T, seconds, a zone and a date alone', () => {
    expect(readTimestamp('2025-08-20 14:30')).toBe('2025-08-20T14:30')
    expect(readTimestamp('2025-08-20T14:30:45')).toBe('2025-08-20T14:30')
    expect(readTimestamp('2025-08-20T04:05:00Z')).toBe('2025-08-20T04:05')
    expect(readTimestamp('2025-08-20 4:05')).toBe('2025-08-20T04:05')
    expect(readTimestamp('2025-08-20')).toBe('2025-08-20T00:00')
  })
  it('reads an Excel date and time, to the minute', () => {
    expect(readTimestamp(45889.5)).toBe('2025-08-20T12:00')
    expect(readTimestamp(45889 + 14.5 / 24)).toBe('2025-08-20T14:30')
    expect(readTimestamp(45889.99999)).toBe('2025-08-21T00:00')
    expect(readTimestamp('45889.25')).toBe('2025-08-20T06:00')
  })
  it('does not guess at anything else', () => {
    expect(readTimestamp('20/08/2025 14:30')).toBeNull()
    expect(readTimestamp('2025-08-20 25:00')).toBeNull()
    expect(readTimestamp('2025-02-30 10:00')).toBeNull()
    expect(readTimestamp(12)).toBeNull()
    expect(readTimestamp('')).toBeNull()
  })
})

describe('parsing a climate import', () => {
  const known = new Set(base.cultivations.map((c) => c.id))
  const HEADER = ['Timestamp', 'Cultivation', 'Parameter', 'Value', 'Setpoint']

  it('reads rows, matches headers without regard to case, ignores other columns and treats a missing setpoint as empty', () => {
    const cells = [
      ['Export of the climate computer'],
      ['Site', ' timestamp ', 'CULTIVATION', 'parameter', 'value', 'setpoint'],
      ['x', '2025-08-20 14:00', TOV, 'Temperature', '23,4', 22.5],
      ['x', 45889.5, TOV, 'CO2', 640, ''],
      [],
    ]
    const result = parseClimateTable(cells, known)
    expect(result.missingColumns).toEqual([])
    expect(result.rows).toEqual([
      { line: 3, cultivation: TOV, parameter: 'Temperature', timestamp: '2025-08-20T14:00', value: 23.4, setpoint: 22.5 },
      { line: 4, cultivation: TOV, parameter: 'CO2', timestamp: '2025-08-20T12:00', value: 640, setpoint: null },
    ])
    expect(result.blankRows).toBe(1)
    const noSetpoint = parseClimateTable([HEADER.slice(0, 4), ['2025-08-20 14:00', TOV, 'Temperature', 23]], known)
    expect(noSetpoint.rows[0]!.setpoint).toBeNull()
  })

  it('names the missing columns and reads nothing', () => {
    const result = parseClimateTable([['Timestamp', 'Cultivation', 'Value'], ['2025-08-20 14:00', TOV, 1]], known)
    expect(result.missingColumns).toEqual(['Parameter'])
    expect(result.rows).toEqual([])
  })

  it('lists what it cannot read, with row numbers, and keeps the first of a reading listed twice', () => {
    const result = parseClimateTable(
      [
        HEADER,
        ['2025-08-20 14:00', 'XX-P9-Nope', 'Temperature', 23, 22],
        ['yesterday', TOV, 'Temperature', 23, 22],
        ['2025-08-20 14:00', TOV, '', 23, 22],
        ['2025-08-20 14:00', TOV, 'Temperature', 'hot', 22],
        ['2025-08-20 14:00', TOV, 'Temperature', '', 22],
        ['2025-08-20 14:00', TOV, 'Temperature', 23, 'n/a'],
        ['2025-08-20 14:00', TOV, 'Tem|perature', 23, 22],
        ['2025-08-20 14:00', TOV, 'Temperature', 23, 22],
        ['2025-08-20 14:00:30', TOV, 'Temperature', 99, 22],
      ],
      known,
    )
    expect(result.rows).toHaveLength(1)
    expect(result.problems.map((p) => p.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 10])
    expect(result.problems[0]!.message).toMatch(/unknown cultivation "XX-P9-Nope"/)
    expect(result.problems[1]!.message).toMatch(/not a date and time/)
    expect(result.problems[3]!.message).toMatch(/Value "hot" is not a number/)
    expect(result.problems[4]!.message).toMatch(/no value/)
    expect(result.problems.at(-1)!.message).toMatch(/already on row 9/)
  })

  it('refuses a file over the row limit without reading any of it', () => {
    const cells = [HEADER, ...Array.from({ length: MAX_CLIMATE_ROWS + 1 }, (_, i) => [`2025-08-20 ${String(i % 24).padStart(2, '0')}:00`, TOV, `P${i}`, 1, 1])]
    const result = parseClimateTable(cells, known)
    expect(result.tooMany).toBe(MAX_CLIMATE_ROWS + 1)
    expect(result.rows).toEqual([])
    expect(parseClimateTable(cells.slice(0, MAX_CLIMATE_ROWS + 1), known).tooMany).toBeNull()
  })
})

describe('previewing a climate import', () => {
  const known = new Set(base.cultivations.map((c) => c.id))
  const stored = (over: Partial<ClimateReading>): ClimateReading => ({ cultivation: TOV, parameter: 'Temperature', timestamp: '2025-08-20T14:00', value: 23, setpoint: 22, createdBy: 'd', createdAt: '2025-08-26T00:00:00.000Z', ...over })
  const parsed = parseClimateTable(
    [
      ['Timestamp', 'Cultivation', 'Parameter', 'Value', 'Setpoint'],
      ['2025-08-20 14:00', TOV, 'Temperature', 23, 22], // the same as stored
      ['2025-08-20 15:00', TOV, 'Temperature', 24, 22], // new
      ['2025-08-20 14:00', TOV, 'CO2', 640, ''], // new
      ['2025-08-21 14:00', 'ON-P1-Cherry', 'Temperature', 21, 22], // new, another cultivation
      ['bad', TOV, 'Temperature', 1, 1],
    ],
    known,
  )

  it('counts new, changed, unchanged and problems, and says what the file covers', () => {
    const preview = previewClimateImport(parsed, [stored({}), stored({ timestamp: '2025-08-20T16:00' })])
    expect(preview.newRows).toHaveLength(3)
    expect(preview.changedRows).toHaveLength(0)
    expect(preview.unchanged).toBe(1)
    expect(preview.problems).toHaveLength(1)
    expect(preview.coverage).toEqual([
      { cultivation: 'ON-P1-Cherry', readings: 1, firstDay: '2025-08-21', lastDay: '2025-08-21', parameters: ['Temperature'] },
      { cultivation: TOV, readings: 3, firstDay: '2025-08-20', lastDay: '2025-08-20', parameters: ['CO2', 'Temperature'] },
    ])
  })

  it('treats a different value or setpoint for the same reading as a change', () => {
    const preview = previewClimateImport(parsed, [stored({ value: 22.5 })])
    expect(preview.changedRows).toHaveLength(1)
    expect(preview.changedRows[0]!.before).toEqual({ value: 22.5, setpoint: 22 })
    expect(previewClimateImport(parsed, [stored({ setpoint: null })]).changedRows).toHaveLength(1)
  })

  it('turns the new and changed readings into rows to save, all with one time and name', () => {
    const preview = previewClimateImport(parsed, [stored({ value: 22.5 })])
    const rows = toClimateReadings(preview, { createdBy: 'dana@example.com', createdAt: '2025-09-01T10:00:00.000Z' })
    expect(rows).toHaveLength(4)
    expect(new Set(rows.map((r) => r.createdAt)).size).toBe(1)
    expect(rows.find((x) => x.parameter === 'CO2')).toEqual({ cultivation: TOV, parameter: 'CO2', timestamp: '2025-08-20T14:00', value: 640, setpoint: null, createdBy: 'dana@example.com', createdAt: '2025-09-01T10:00:00.000Z' })
  })

  it('reads an .xlsx the same way as a CSV, from the sheet called Climate or the one with the columns', async () => {
    const rows = [['Timestamp', 'Cultivation', 'Parameter', 'Value', 'Setpoint'], ['2025-08-20 14:00', TOV, 'Temperature', 23.4, 22.5]]
    const bytes = await writeWorkbook([{ name: 'Notes', rows: [['nothing here']] }, { name: 'Data', rows }])
    const file = (name: string, data: Uint8Array) => ({ name, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, text: async () => '' })
    const read = await readTableFile(file('climate.xlsx', bytes), CLIMATE_TABLE)
    expect(read.sheet).toBe('Data')
    expect(parseClimateTable(read.cells, known).rows[0]).toMatchObject({ timestamp: '2025-08-20T14:00', value: 23.4, setpoint: 22.5 })
    const csv = { name: 'climate.csv', arrayBuffer: async () => new ArrayBuffer(0), text: async () => 'Timestamp,Cultivation,Parameter,Value,Setpoint\n2025-08-20 14:00,PA-P2-TOV,Temperature,"23,4",22.5\n' }
    expect(parseClimateTable((await readTableFile(csv, CLIMATE_TABLE)).cells, known).rows[0]).toMatchObject({ value: 23.4 })
    const none = await writeWorkbook([{ name: 'A', rows: [['x']] }, { name: 'B', rows: [['y']] }])
    await expect(readTableFile(file('n.xlsx', none), CLIMATE_TABLE)).rejects.toThrow(/no sheet called "Climate"/)
  }, 30_000)
})

describe('the 24-hour series', () => {
  const r = (parameter: string, timestamp: string, value: number, setpoint: number | null, cultivation = TOV): ClimateReading => ({ cultivation, parameter, timestamp, value, setpoint, createdBy: 'd', createdAt: '2025-08-26T00:00:00.000Z' })
  const readings = [
    r('Temperature', '2025-08-20T14:30', 24, 22),
    r('Temperature', '2025-08-20T02:00', 19, 18),
    r('CO2', '2025-08-20T10:00', 700, null),
    r('Temperature', '2025-08-21T02:00', 18, 18),
    r('Temperature', '2025-08-20T02:00', 30, 30, 'PA-P1-TOV'),
  ]
  it('lists the days with readings for one cultivation', () => {
    expect(readingDays(readings, TOV)).toEqual(['2025-08-20', '2025-08-21'])
    expect(readingDays(readings, 'AZ-P1-Snack')).toEqual([])
    expect(readingDays([], TOV)).toEqual([])
  })
  it('gives realised against setpoint per parameter, in time order, with the average gap', () => {
    const series = daySeries(readings, TOV, '2025-08-20')
    expect(series.map((s) => s.parameter)).toEqual(['CO2', 'Temperature'])
    expect(series[1]!.points).toEqual([
      { hour: 2, value: 19, setpoint: 18 },
      { hour: 14.5, value: 24, setpoint: 22 },
    ])
    expect(series[1]!.meanGap).toBe(1.5)
    expect(series[0]!.meanGap).toBeNull() // no setpoint for CO2
    expect(daySeries(readings, TOV, '2025-08-22')).toEqual([])
    expect(hourOf('2025-08-20T14:30')).toBe(14.5)
    expect(addDays('2025-08-20', 1)).toBe('2025-08-21')
  })
})
