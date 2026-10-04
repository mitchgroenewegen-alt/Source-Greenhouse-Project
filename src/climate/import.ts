// Reads a climate computer export into readings, and works out what an import would do before anything is saved.
// One simple layout, as CSV or the first matching sheet of an .xlsx:
//
//   Timestamp            Cultivation   Parameter     Value   Setpoint
//   2025-08-20 14:00     PA-P2-TOV     Temperature   23.4    22.5
//
// Timestamp is local time as written (2025-08-20 14:00, 2025-08-20T14:00:30 or an Excel date and time); no time zone is applied.
// Cultivation must be an id the app knows. Parameter is free text. Value is required, Setpoint may be empty.
// Nothing is guessed: a row it cannot read is a problem, left out, with its row number. Pure functions; reading the file is in
// src/exchange/file.ts.

import { excelSerialToIso } from '../data/dates'
import { isIsoDate } from '../setup/validate'
import { readNumber } from '../exchange/parse'
import type { TableKind } from '../exchange/file'
import type { ClimateReading } from '../workspace/types'

/** The most readings one file may hold. A year of hourly values for six parameters of one cultivation is about 52,000, so a month at a time is the intended size. */
export const MAX_CLIMATE_ROWS = 20_000

export const CLIMATE_REQUIRED = ['Timestamp', 'Cultivation', 'Parameter', 'Value'] as const
export const CLIMATE_COLUMNS = [...CLIMATE_REQUIRED, 'Setpoint'] as const

export interface ParsedReading {
  /** The row number in the file, counting the header as 1. */
  line: number
  cultivation: string
  parameter: string
  timestamp: string
  value: number
  setpoint: number | null
}

export interface ClimateProblem {
  line: number
  message: string
}

export interface ClimateParse {
  rows: ParsedReading[]
  problems: ClimateProblem[]
  missingColumns: string[]
  blankRows: number
  /** Set when the file has more data rows than MAX_CLIMATE_ROWS; then no row is read. */
  tooMany: number | null
}

const isEmpty = (cell: unknown) => cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '')
const textOf = (cell: unknown) => (isEmpty(cell) ? '' : String(cell).trim())
const normal = (cell: unknown) => textOf(cell).toLowerCase()
const pad = (n: number) => String(n).padStart(2, '0')

const SERIAL_MIN = 36526 // 2000-01-01
const SERIAL_MAX = 73415 // 2099-12-31
const TEXT = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2}(?:[.,]\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})?)?$/

function fromSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < SERIAL_MIN || serial >= SERIAL_MAX + 1) return null
  const minutes = Math.round(serial * 1440) // to the minute; also carries 23:59:40 over to the next day
  const day = Math.floor(minutes / 1440)
  const inDay = minutes - day * 1440
  return `${excelSerialToIso(day)}T${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`
}

/** "2025-08-20T14:30" from an Excel date-time number, an ISO-like text (a seconds part is dropped) or a Date; null when it is none of them. */
export function readTimestamp(cell: unknown): string | null {
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell.toISOString().slice(0, 16)
  if (typeof cell === 'number') return fromSerial(cell)
  const text = textOf(cell)
  if (/^\d{5}([.,]\d+)?$/.test(text)) return fromSerial(Number(text.replace(',', '.')))
  const m = text.match(TEXT)
  if (!m || !isIsoDate(m[1]!)) return null
  const hour = m[2] === undefined ? 0 : Number(m[2])
  const minute = m[3] === undefined ? 0 : Number(m[3])
  if (hour > 23 || minute > 59) return null
  return `${m[1]}T${pad(hour)}:${pad(minute)}`
}

/** Find the header row and the position of each column of the layout (matched without regard to case or spaces). */
export function findClimateHeader(cells: unknown[][]): { rowIndex: number; columns: Map<string, number>; missing: string[] } {
  const wanted = CLIMATE_COLUMNS.map((c) => c.toLowerCase())
  let rowIndex = cells.findIndex((row) => row.some((cell) => wanted.includes(normal(cell))))
  if (rowIndex < 0) rowIndex = 0
  const header = (cells[rowIndex] ?? []).map(normal)
  const columns = new Map<string, number>()
  const missing: string[] = []
  for (const name of CLIMATE_COLUMNS) {
    const i = header.indexOf(name.toLowerCase())
    if (i >= 0) columns.set(name, i)
    else if (name !== 'Setpoint') missing.push(name)
  }
  return { rowIndex, columns, missing }
}

/** How a climate file is read: the sheet an .xlsx is read from (one called "Climate", the only sheet, or the first with the columns). */
export const CLIMATE_TABLE: TableKind = {
  sheetName: 'climate',
  hasColumns: (cells) => findClimateHeader(cells).missing.length === 0,
  noSheetMessage: 'There is no sheet called "Climate" in this workbook, and no other sheet has the columns Timestamp, Cultivation, Parameter and Value.',
}

export function parseClimateTable(cells: unknown[][], knownCultivations: ReadonlySet<string>): ClimateParse {
  const { rowIndex, columns, missing } = findClimateHeader(cells)
  const result: ClimateParse = { rows: [], problems: [], missingColumns: missing, blankRows: 0, tooMany: null }
  if (missing.length > 0) return result

  const dataRows = cells.length - rowIndex - 1
  if (dataRows > MAX_CLIMATE_ROWS) {
    result.tooMany = dataRows
    return result
  }

  const at = (row: unknown[], name: string) => (columns.has(name) ? row[columns.get(name)!] : null)
  const firstLine = new Map<string, number>()
  for (let i = rowIndex + 1; i < cells.length; i++) {
    const row = cells[i]!
    const line = i + 1
    if (row.every(isEmpty)) {
      result.blankRows++
      continue
    }
    const cultivation = textOf(at(row, 'Cultivation'))
    const parameter = textOf(at(row, 'Parameter'))
    const timestamp = readTimestamp(at(row, 'Timestamp'))
    const value = readNumber(at(row, 'Value'))
    const setpoint = readNumber(at(row, 'Setpoint'))

    const issues: string[] = []
    if (cultivation === '') issues.push('no cultivation')
    else if (!knownCultivations.has(cultivation)) issues.push(`unknown cultivation "${cultivation}"`)
    if (parameter === '') issues.push('no parameter')
    else if (parameter.includes('|') || parameter.length > 60) issues.push(`parameter "${parameter.slice(0, 20)}" must be up to 60 characters and without "|"`)
    if (timestamp === null) issues.push(`"${textOf(at(row, 'Timestamp'))}" is not a date and time it can read`)
    if (value === null) issues.push('no value')
    else if (value === undefined) issues.push(`Value "${textOf(at(row, 'Value'))}" is not a number`)
    if (setpoint === undefined) issues.push(`Setpoint "${textOf(at(row, 'Setpoint'))}" is not a number`)
    if (issues.length > 0) {
      result.problems.push({ line, message: `Row ${line}: ${issues.join('; ')}. Left out.` })
      continue
    }

    const key = `${cultivation}|${parameter}|${timestamp}`
    const first = firstLine.get(key)
    if (first !== undefined) {
      result.problems.push({ line, message: `Row ${line}: ${cultivation}, ${parameter}, ${timestamp!.replace('T', ' ')} is already on row ${first}. Only the first one is used.` })
      continue
    }
    firstLine.set(key, line)
    result.rows.push({ line, cultivation, parameter, timestamp: timestamp!, value: value as number, setpoint: setpoint as number | null })
  }
  return result
}

export interface ReadingChange {
  row: ParsedReading
  /** The value and setpoint stored now; null for a new reading. */
  before: { value: number; setpoint: number | null } | null
}

export interface ClimatePreview {
  newRows: ReadingChange[]
  changedRows: ReadingChange[]
  unchanged: number
  problems: ClimateProblem[]
  /** What the file covers (all rows read, new or not): per cultivation the number of readings and the first and last day. */
  coverage: { cultivation: string; readings: number; firstDay: string; lastDay: string; parameters: string[] }[]
}

const SAME_WITHIN = 1e-9
const same = (a: number | null, b: number | null) => a === b || (a !== null && b !== null && Math.abs(a - b) <= SAME_WITHIN)
export const readingKey = (r: Pick<ClimateReading, 'cultivation' | 'parameter' | 'timestamp'>) => `${r.cultivation}|${r.parameter}|${r.timestamp}`

/** Compare the file with the readings stored now: which are new, which change a value or setpoint, which are the same (skipped). */
export function previewClimateImport(parsed: ClimateParse, current: readonly ClimateReading[]): ClimatePreview {
  const byKey = new Map(current.map((r) => [readingKey(r), r]))
  const preview: ClimatePreview = { newRows: [], changedRows: [], unchanged: 0, problems: parsed.problems, coverage: [] }
  const cover = new Map<string, { readings: number; firstDay: string; lastDay: string; parameters: Set<string> }>()

  for (const row of parsed.rows) {
    const now = byKey.get(readingKey(row))
    if (!now) preview.newRows.push({ row, before: null })
    else if (same(now.value, row.value) && same(now.setpoint, row.setpoint)) preview.unchanged++
    else preview.changedRows.push({ row, before: { value: now.value, setpoint: now.setpoint } })

    const day = row.timestamp.slice(0, 10)
    const c = cover.get(row.cultivation) ?? { readings: 0, firstDay: day, lastDay: day, parameters: new Set<string>() }
    c.readings++
    if (day < c.firstDay) c.firstDay = day
    if (day > c.lastDay) c.lastDay = day
    c.parameters.add(row.parameter)
    cover.set(row.cultivation, c)
  }
  preview.coverage = [...cover]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cultivation, c]) => ({ cultivation, readings: c.readings, firstDay: c.firstDay, lastDay: c.lastDay, parameters: [...c.parameters].sort() }))
  return preview
}

/** The readings to save: every new and changed one. All share one time. */
export function toClimateReadings(preview: ClimatePreview, meta: { createdBy: string; createdAt: string }): ClimateReading[] {
  return [...preview.newRows, ...preview.changedRows].map(({ row }) => ({
    cultivation: row.cultivation,
    parameter: row.parameter,
    timestamp: row.timestamp,
    value: row.value,
    setpoint: row.setpoint,
    createdBy: meta.createdBy,
    createdAt: meta.createdAt,
  }))
}
