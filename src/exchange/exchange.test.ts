import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { groupEntries, logItems } from '../editing/log'
import { detectFlags } from '../flags'
import { applyDecisions, buildWeekly, weeklyKey } from '../scoring/effective'
import { loadTestData } from '../test/loadData'
import { emptyWorkspace, type EnteredRow, type ValueEdit, type WorkspaceCultivation, type WorkspaceData } from '../workspace/types'
import { merge } from '../workspace/merge'
import { isoToExcelSerial } from '../data/dates'
import { buildExport, exportFileName, rowSources, type ExportInput } from './exportBook'
import { readTableFile, ImportFileError } from './file'
import { parseKpiTable, readDate, readNumber } from './parse'
import { previewImport, toImportedRows } from './preview'
import { facilitySummarySheet, scorecardSheet } from './viewSheets'
import { readWorkbook, writeWorkbook } from './xlsxFile'

const base = loadTestData()
/** Writing and reading a workbook of 16,000 rows takes a few seconds, more on a busy machine. */
const SLOW = 60_000
const PA = 'PA-P1-TOV'
const known = { cultivations: new Set(base.cultivations.map((c) => c.id)), kpis: new Set(base.kpis.map((k) => k.name)) }
const HEADER = ['Date', 'Cultivation', 'KPI', 'Actual', 'Target']

describe('reading dates and numbers', () => {
  it('reads Excel serial dates, ISO strings (with a time) and Dates', () => {
    expect(readDate(45803)).toBe('2025-05-26')
    expect(readDate('2025-05-26')).toBe('2025-05-26')
    expect(readDate('2025-05-26T00:00:00.000Z')).toBe('2025-05-26')
    expect(readDate('45803')).toBe('2025-05-26')
    expect(readDate(new Date('2025-05-26T00:00:00Z'))).toBe('2025-05-26')
  })

  it('does not guess at anything else', () => {
    expect(readDate('26/05/2025')).toBeNull()
    expect(readDate('2025-02-30')).toBeNull()
    expect(readDate(12)).toBeNull()
    expect(readDate('')).toBeNull()
    expect(readDate(null)).toBeNull()
  })

  it('reads numbers, a decimal comma, and empty as not recorded; text is not a number', () => {
    expect(readNumber(12.5)).toBe(12.5)
    expect(readNumber('12,5')).toBe(12.5)
    expect(readNumber(' 0 ')).toBe(0)
    expect(readNumber('')).toBeNull()
    expect(readNumber(null)).toBeNull()
    expect(readNumber('n/a')).toBeUndefined()
    expect(readNumber('1.2.3')).toBeUndefined()
    expect(readNumber(Infinity)).toBeUndefined()
  })
})

describe('parsing an import table', () => {
  it('matches the headers whatever the case and spaces, ignores other columns and finds the header below a title', () => {
    const cells = [
      ['KPI data'],
      ['ISO week', ' date ', 'CULTIVATION', 'kpi', 'Facility', 'actual', 'Target '],
      ['2025-W34', isoToExcelSerial('2025-08-18'), PA, 'Harvest', 'Pennsylvania', 0.5, '0,63'],
    ]
    const result = parseKpiTable(cells, known)
    expect(result.missingColumns).toEqual([])
    expect(result.problems).toEqual([])
    expect(result.rows).toEqual([{ line: 3, cultivation: PA, kpi: 'Harvest', date: '2025-08-18', actual: 0.5, target: 0.63 }])
  })

  it('names a missing required column and reads no rows', () => {
    const result = parseKpiTable([['Date', 'Cultivation', 'KPI', 'Actual'], ['2025-08-18', PA, 'Harvest', 1]], known)
    expect(result.missingColumns).toEqual(['Target'])
    expect(result.rows).toEqual([])
  })

  it('lists problems instead of guessing, with the row they are on', () => {
    const result = parseKpiTable(
      [
        HEADER,
        ['2025-08-18', 'XX-P9-TOV', 'Harvest', 1, 1],
        ['2025-08-18', PA, 'Harvset', 1, 1],
        ['18 August', PA, 'Harvest', 1, 1],
        ['2025-08-18', PA, 'Harvest', 'lots', ''],
        ['2025-08-19', PA, 'Harvest', 1, 2],
        ['2025-08-19', PA, 'Harvest', 3, 4],
        [null, null, null, null, null],
      ],
      known,
    )
    expect(result.rows.map((r) => r.line)).toEqual([6])
    expect(result.blankRows).toBe(1)
    expect(result.problems.map((p) => p.line)).toEqual([2, 3, 4, 5, 7])
    expect(result.problems[0]!.message).toContain('unknown cultivation "XX-P9-TOV"')
    expect(result.problems[1]!.message).toContain('unknown KPI "Harvset"')
    expect(result.problems[2]!.message).toContain('not a date')
    expect(result.problems[3]!.message).toContain('Actual "lots" is not a number')
    expect(result.problems[4]!.message).toContain('already on row 6')
  })

  it('keeps an empty cell as not recorded, never zero', () => {
    const result = parseKpiTable([HEADER, ['2025-08-18', PA, 'Harvest', '', 0]], known)
    expect(result.rows[0]).toMatchObject({ actual: null, target: 0 })
  })
})

describe('the import preview', () => {
  const day = base.daily.find((r) => r.cultivation === PA && r.kpi === 'Harvest' && r.date === '2025-08-18')!
  const table = (...rows: unknown[][]) => parseKpiTable([HEADER, ...rows], known)

  it('sorts the days into new, changed and unchanged', () => {
    const preview = previewImport(
      table(
        ['2025-08-18', PA, 'Harvest', day.actual, day.target], // as it is
        ['2025-08-19', PA, 'Harvest', 5, ''], // another actual
        ['2025-08-25', PA, 'Harvest', 0.7, 0.6], // after the data ends
      ),
      base.daily,
      base.cultivations,
    )
    expect(preview.unchanged).toBe(1)
    expect(preview.changedRows).toHaveLength(1)
    expect(preview.changedRows[0]!.before!.actual).not.toBe(5)
    expect(preview.changedRows[0]!.after.actual).toBe(5)
    expect(preview.newRows).toHaveLength(1)
    expect(preview.newRows[0]!.row.date).toBe('2025-08-25')
  })

  it('leaves a value alone when the file has an empty cell for it', () => {
    const next = base.daily.find((r) => r.cultivation === PA && r.kpi === 'Harvest' && r.date === '2025-08-19')!
    const preview = previewImport(table(['2025-08-19', PA, 'Harvest', 5, '']), base.daily, base.cultivations)
    expect(preview.changedRows[0]!.after).toEqual({ actual: 5, target: next.target })
  })

  it('counts how many of the values the data checks would flag', () => {
    const preview = previewImport(table(['2025-08-25', 'PA-P2-TOV', 'Temperature (24h)', 69, 21], ['2025-08-26', 'PA-P2-TOV', 'Temperature (24h)', 21, 21]), base.daily, base.cultivations)
    expect(preview.newRows).toHaveLength(2)
    expect(preview.flagged).toBe(1)
    expect(preview.flaggedExamples[0]).toMatchObject({ cultivation: 'PA-P2-TOV', date: '2025-08-25' })
  })

  it('carries the problems of the file', () => {
    const preview = previewImport(table(['2025-08-25', 'nowhere', 'Harvest', 1, 1]), base.daily, base.cultivations)
    expect(preview.problems).toHaveLength(1)
    expect(preview.newRows).toHaveLength(0)
  })

  it('turns new and changed days into imported rows that share one time', () => {
    const preview = previewImport(table(['2025-08-25', PA, 'Harvest', 0.7, 0.6], ['2025-08-19', PA, 'Harvest', 5, '']), base.daily, base.cultivations)
    const rows = toImportedRows(preview, { createdBy: 'dana@example.com', createdAt: '2025-09-01T10:00:00.000Z' })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.source === 'imported' && r.createdAt === '2025-09-01T10:00:00.000Z')).toBe(true)
  })
})

// ---- The export, and the round trip ----

const entered = (overrides: Partial<EnteredRow> = {}): EnteredRow => ({
  cultivation: PA,
  date: '2025-08-25',
  kpi: 'Harvest',
  actual: 0.7,
  target: 0.6,
  createdBy: 'dana@example.com',
  createdAt: '2025-09-01T10:00:00.000Z',
  source: 'entered',
  ...overrides,
})
const valueEdit = (overrides: Partial<ValueEdit> = {}): ValueEdit => ({
  id: 'edit|1',
  cultivation: PA,
  kpi: 'Harvest',
  dateFrom: '2025-08-18',
  dateTo: '2025-08-18',
  field: 'target',
  newValue: 1,
  originalValue: 0.6,
  createdBy: 'dana@example.com',
  createdAt: '2025-09-02T10:00:00.000Z',
  reason: 'Edited',
  source: 'edited',
  ...overrides,
})
const newCultivation: WorkspaceCultivation = {
  id: 'PA-P1-NEW',
  facility: 'Pennsylvania',
  greenhouse: 'Phase 1',
  crop: 'Tomato',
  variety: 'TOV',
  plantingDate: '2025-08-01',
  areaM2: 1000,
  cropWeekAtEnd: 4,
  fruitType: 'tov',
  plannedEndDate: '2026-06-30',
  archived: false,
}

function exportInput(workspace: WorkspaceData): ExportInput {
  const merged = merge(base, workspace)
  const flags = detectFlags(merged.daily, merged.cultivations)
  const lookup = buildWeekly(applyDecisions(merged.daily, flags, workspace.decisions, false))
  return {
    now: new Date(2025, 8, 3, 10, 30),
    who: 'dana@example.com',
    workbook: base,
    merged,
    workspace,
    flags,
    decisions: workspace.decisions,
    point: (c, k, w) => lookup.get(weeklyKey(c, k, w)),
  }
}

const filled: WorkspaceData = {
  ...emptyWorkspace(),
  cultivations: [newCultivation],
  enteredRows: [entered(), entered({ date: '2025-08-26', source: 'imported', createdAt: '2025-09-01T11:00:00.000Z' })],
  valueEdits: [valueEdit(), valueEdit({ id: 'corrected|x', dateFrom: '2025-08-19', dateTo: '2025-08-19', field: 'actual', newValue: 0.4, source: 'corrected', createdAt: '2025-09-03T10:00:00.000Z' })],
}

/** A file as the browser hands it over. */
const asFile = (name: string, bytes: Uint8Array | string) => ({
  name,
  arrayBuffer: async () => (typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes).slice().buffer as ArrayBuffer,
  text: async () => (typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes)),
})

describe('the export', () => {
  const input = exportInput(filled)
  const sheets = buildExport(input)
  const sheet = (name: string) => sheets.find((s) => s.name === name)!

  it('has the sheets in order, without Financials', () => {
    expect(sheets.map((s) => s.name)).toEqual(['Read me', 'Greenhouses', 'KPIs', 'Weekly scores', 'Forecast', 'Data checks', 'Edit log', 'Settings'])
  })

  it('has one Forecast row per cultivation and forecast week, with low, expected, high and the method', () => {
    // Made from the workbook alone: the filled workspace above adds a day after the last data week, which moves the forecast's start.
    const rows = buildExport(exportInput(emptyWorkspace())).find((s) => s.name === 'Forecast')!.rows
    expect(rows[0]).toEqual(['Cultivation', 'Facility', 'Data up to week', 'Forecast week', 'Low (kg/m²)', 'Expected (kg/m²)', 'High (kg/m²)', 'Expected (kg)', 'Method', 'Correction factor', 'Weeks compared'])
    const pa = rows.slice(1).filter((r) => r[0] === PA)
    expect(pa).toHaveLength(6)
    expect(new Set(pa.map((r) => r[8]))).toEqual(new Set(['Corrected']))
    for (const r of pa) {
      expect(r[4] as number).toBeLessThanOrEqual(r[5] as number)
      expect(r[5] as number).toBeLessThanOrEqual(r[6] as number)
    }
    expect(new Set(pa.map((r) => r[2]))).toEqual(new Set(['2025-W34']))
    expect(pa.map((r) => r[3])).toEqual(['2025-W35', '2025-W36', '2025-W37', '2025-W38', '2025-W39', '2025-W40'])
    expect(new Set(rows.slice(1).map((r) => r[0])).size).toBe(base.cultivations.length)
    // The same sheet from the filled workspace still has a row for every forecast cultivation and week, and a method for each.
    for (const r of sheet('Forecast').rows.slice(1)) expect(['Corrected', 'Uncorrected estimate']).toContain(r[8])
  })

  it('has one KPIs row per merged day, with the original columns first', () => {
    const kpis = sheet('KPIs')
    expect(kpis.rows[0]!.slice(0, 13)).toEqual(['Date', 'ISO week', 'Company', 'Facility', 'Greenhouse', 'Cultivation', 'Crop', 'Variety', 'KPI category', 'KPI', 'Unit', 'Actual', 'Target'])
    expect(kpis.rows[0]!.slice(13)).toEqual(['Original actual', 'Original target', 'Source'])
    expect(kpis.rows).toHaveLength(input.merged.daily.length + 1)
    expect(input.merged.daily.length).toBe(base.daily.length + 2)
  })

  it('says where each row comes from, and keeps the workbook values in the original columns', () => {
    const rows = sheet('KPIs').rows.slice(1)
    const find = (date: string) => rows.find((r) => (r[0] as { date: string }).date === date && r[5] === PA && r[9] === 'Harvest')!
    expect(find('2025-08-17')[15]).toBe('workbook')
    expect(find('2025-08-18')[15]).toBe('edited')
    expect(find('2025-08-18')[12]).toBe(1)
    expect(find('2025-08-18')[14]).toBe(base.daily.find((r) => r.cultivation === PA && r.kpi === 'Harvest' && r.date === '2025-08-18')!.target)
    expect(find('2025-08-19')[15]).toBe('corrected')
    expect(find('2025-08-25')[15]).toBe('entered')
    expect(find('2025-08-25')[13]).toBeNull()
    expect(find('2025-08-26')[15]).toBe('imported')
    expect(rowSources(input).size).toBe(input.merged.daily.length)
  })

  it('lists the new cultivation, with fruit type, planned end and archived', () => {
    const rows = sheet('Greenhouses').rows
    expect(rows[0]!.slice(0, 9)).toEqual(['Company', 'Facility', 'Greenhouse', 'Cultivation', 'Crop', 'Variety', 'Planting date', 'Growing area (m²)', 'Crop week on 26 Aug 2025'])
    expect(rows[0]!.slice(9)).toEqual(['Fruit type', 'Planned end date', 'Archived'])
    expect(rows).toHaveLength(base.cultivations.length + 2)
    expect(rows.at(-1)).toEqual(['Perfect Produce', 'Pennsylvania', 'Phase 1', 'PA-P1-NEW', 'Tomato', 'TOV', { date: '2025-08-01' }, 1000, 4, 'TOV', { date: '2026-06-30' }, 'No'])
  })

  it('says what was exported, by whom, and how many edits and entries are applied', () => {
    const text = sheet('Read me').rows.flat().filter((c): c is string => typeof c === 'string')
    expect(text.some((t) => t.includes('by dana@example.com'))).toBe(true)
    expect(text.some((t) => t.includes('2 value edits') && t.includes('2 days typed in or imported (1 entered, 1 imported)'))).toBe(true)
    expect(text.some((t) => t.includes('2025-W22 to 2025-W35'))).toBe(true)
  })

  it('has the weekly scores with a status, the data checks with their decisions and the edit log', () => {
    const weekly = sheet('Weekly scores').rows
    expect(weekly[0]).toContain('Status')
    expect(weekly.length).toBeGreaterThan(1000)
    const checks = sheet('Data checks').rows
    expect(checks.length).toBe(input.flags.length + 1)
    expect(checks.slice(1).every((r) => r[8] === 'Waiting for a decision')).toBe(true)
    // Two entries (entered, imported) and two edits.
    expect(sheet('Edit log').rows).toHaveLength(5)
    expect(sheet('Settings').rows.length).toBeGreaterThan(5)
  })

  it('names the file by the date', () => {
    expect(exportFileName(new Date(2025, 8, 3, 10, 30))).toBe('crop-performance-2025-09-03.xlsx')
    expect(exportFileName(new Date(), 'scorecard-2025-W34')).toBe('crop-performance-scorecard-2025-W34.xlsx')
  })

  it('writes a real .xlsx that reads back with the same sheets and dates as dates', async () => {
    const bytes = await writeWorkbook(sheets)
    const book = await readWorkbook(bytes)
    expect(book.map((s) => s.name)).toEqual(sheets.map((s) => s.name))
    const kpis = book.find((s) => s.name === 'KPIs')!.cells
    expect(kpis).toHaveLength(input.merged.daily.length + 1)
    expect(kpis[1]![0]).toBe(isoToExcelSerial(input.merged.daily[0]!.date))
  }, SLOW)
})

describe('exporting and importing again', () => {
  it('gives zero changes (the app\'s own export, with edits, entries and a new cultivation)', async () => {
    const input = exportInput(filled)
    const bytes = await writeWorkbook(buildExport(input))
    const { cells, sheet } = await readTableFile(asFile('crop-performance-2025-09-03.xlsx', bytes))
    expect(sheet).toBe('KPIs')
    const known = { cultivations: new Set(input.merged.cultivations.map((c) => c.id)), kpis: new Set(input.merged.kpis.map((k) => k.name)) }
    const parsed = parseKpiTable(cells, known)
    expect(parsed.problems).toEqual([])
    expect(parsed.rows).toHaveLength(input.merged.daily.length)
    const preview = previewImport(parsed, input.merged.daily, input.merged.cultivations)
    expect(preview.newRows).toHaveLength(0)
    expect(preview.changedRows).toHaveLength(0)
    expect(preview.unchanged).toBe(input.merged.daily.length)
    expect(preview.flagged).toBe(0)
  }, SLOW)

  it('gives zero changes for the original workbook against the data it was read into', async () => {
    const bytes = new Uint8Array(readFileSync(new URL('../../data/Perfect-Produce-Growing-Data.xlsx', import.meta.url)))
    const { cells, sheet } = await readTableFile(asFile('Perfect-Produce-Growing-Data.xlsx', bytes))
    expect(sheet).toBe('KPIs')
    const parsed = parseKpiTable(cells, known)
    expect(parsed.problems).toEqual([])
    const preview = previewImport(parsed, base.daily, base.cultivations)
    expect(preview.newRows.length + preview.changedRows.length).toBe(0)
    expect(preview.unchanged).toBe(base.daily.length)
  }, SLOW)

  it('reads a CSV with the same columns', async () => {
    const csv = 'date,cultivation,kpi,actual,target\r\n2025-08-25,PA-P1-TOV,Harvest,0.7,0.6\r\n'
    const read = await readTableFile(asFile('days.csv', csv))
    expect(read.sheet).toBeNull()
    const preview = previewImport(parseKpiTable(read.cells, known), base.daily, base.cultivations)
    expect(preview.newRows).toHaveLength(1)
  })

  it('says so when the file is not something it can read', async () => {
    await expect(readTableFile(asFile('notes.txt', 'hello'))).rejects.toBeInstanceOf(ImportFileError)
  })

  it('finds no columns in a file that is not a table', async () => {
    const read = await readTableFile(asFile('broken.xlsx', 'not a workbook'))
    expect(parseKpiTable(read.cells, known).missingColumns).toHaveLength(5)
  })

  it('stays quick on a file of the size of the workbook', () => {
    const cells: unknown[][] = [HEADER, ...base.daily.map((r) => [isoToExcelSerial(r.date), r.cultivation, r.kpi, r.actual, r.target])]
    const started = Date.now()
    const preview = previewImport(parseKpiTable(cells, known), base.daily, base.cultivations)
    expect(preview.unchanged).toBe(base.daily.length)
    expect(Date.now() - started).toBeLessThan(3000)
  })
})

describe('the entries of the edit log', () => {
  it('group the rows of one cultivation, person and moment, newest first alongside the edits', () => {
    const rows = [entered(), entered({ date: '2025-08-26', kpi: 'Waste' }), entered({ createdAt: '2025-09-05T10:00:00.000Z', source: 'imported', cultivation: 'PA-P2-TOV' })]
    const groups = groupEntries(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ cultivation: 'PA-P2-TOV', source: 'imported' })
    expect(groups[1]).toMatchObject({ kpis: ['Harvest', 'Waste'], dateFrom: '2025-08-25', dateTo: '2025-08-26' })
    const items = logItems([valueEdit()], rows)
    expect(items.map((i) => i.type)).toEqual(['entry', 'edit', 'entry'])
  })
})

describe('the exports of a screen', () => {
  it('has the scorecard as a table with a header row and a row per cultivation', async () => {
    const { scoreCultivationWeek } = await import('../scoring/summary')
    const flags = detectFlags(base.daily, base.cultivations)
    const lookup = buildWeekly(applyDecisions(base.daily, flags, [], false))
    const week = base.weeks.at(-1)!
    const rows = base.cultivations.map((cultivation) => ({ cultivation, score: scoreCultivationWeek(lookup, cultivation.id, week.id), state: 'ready' as const, openFlags: 2 }))
    const sheet = scorecardSheet(rows, week)
    expect(sheet.name).toBe('Scorecard W34')
    expect(sheet.rows).toHaveLength(base.cultivations.length + 1)
    expect(sheet.rows[0]).toContain('Production status')
    expect(sheet.rows[1]![0]).toBe(base.cultivations[0]!.id)
    expect(sheet.rows.flat().some((c) => c === 'Off target' || c === 'On track')).toBe(true)
    expect(sheet.rows.every((r) => r.length === sheet.rows[0]!.length)).toBe(true)
  })

  it('has the facility summary rows', () => {
    const empty = { areaM2: 0, actual: null, budget: null, variance: null, status: null, actualTonnes: null, budgetTonnes: null }
    const sheet = facilitySummarySheet([{ label: 'All facilities', cardId: null, cultivationCount: 8, areaM2: 100, week: empty, cumulative: empty }], base.weeks.at(-1)!)
    expect(sheet.rows).toHaveLength(2)
    expect(sheet.rows[1]![0]).toBe('All facilities')
    expect(sheet.rows[1]!.length).toBe(sheet.rows[0]!.length)
  })
})
