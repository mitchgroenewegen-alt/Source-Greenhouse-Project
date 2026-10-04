// Reads the rows of an imported table (the KPIs sheet of the workbook, of the app's own export, or a CSV with the same
// columns) into days, and lists what could not be read. Nothing is guessed: a row with an unknown cultivation or KPI, a bad
// date or a value that is not a number is a problem, and it is left out. Pure functions; reading the file is in file.ts.

import { excelSerialToIso } from '../data/dates'
import { isIsoDate } from '../setup/validate'

/** The columns an import needs. Others (ISO week, Facility, Unit, ...) may be there and are ignored. */
export const REQUIRED_COLUMNS = ['Date', 'Cultivation', 'KPI', 'Actual', 'Target'] as const

export interface ParsedRow {
  /** The row number in the file, counting the header as 1, so it matches what the spreadsheet shows. */
  line: number
  cultivation: string
  kpi: string
  date: string
  /** null: the cell was empty. */
  actual: number | null
  target: number | null
}

export interface ImportProblem {
  line: number
  message: string
}

export interface ParseResult {
  rows: ParsedRow[]
  problems: ImportProblem[]
  /** Required columns the header row does not have; then no row is read. */
  missingColumns: string[]
  /** Rows with nothing in them, skipped without comment. */
  blankRows: number
}

export interface KnownNames {
  cultivations: ReadonlySet<string>
  kpis: ReadonlySet<string>
}

/** Excel day counts for 2000-01-01 and 2099-12-31: anything else is a number that is not a date. */
const SERIAL_MIN = 36526
const SERIAL_MAX = 73415

const isEmpty = (cell: unknown) => cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '')
const textOf = (cell: unknown) => (isEmpty(cell) ? '' : String(cell).trim())

/** An ISO date from an Excel day count, an ISO string (a time after it is ignored) or a Date; null when it is none of them. */
export function readDate(cell: unknown): string | null {
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell.toISOString().slice(0, 10)
  if (typeof cell === 'number') return Number.isFinite(cell) && cell >= SERIAL_MIN && cell <= SERIAL_MAX ? excelSerialToIso(cell) : null
  const text = textOf(cell)
  if (/^\d{5}(\.\d+)?$/.test(text)) return readDate(Number(text)) // an Excel day count saved as text in a CSV
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T ])/)
  return iso && isIsoDate(iso[1]!) ? iso[1]! : null
}

const NUMBER_TEXT = /^[-+]?(\d+([.,]\d+)?|[.,]\d+)([eE][-+]?\d+)?$/

/** A number from a cell: empty gives null (not recorded, never zero); "12,5" and "12.5" both work; anything else is `undefined`. */
export function readNumber(cell: unknown): number | null | undefined {
  if (isEmpty(cell)) return null
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : undefined
  const text = textOf(cell)
  if (!NUMBER_TEXT.test(text)) return undefined
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
}

const normal = (cell: unknown) => textOf(cell).toLowerCase()

/** Find the header row and the position of each required column (headers match whatever the case or spaces around them). */
export function findHeader(cells: unknown[][]): { rowIndex: number; columns: Map<string, number>; missing: string[] } {
  const wanted = REQUIRED_COLUMNS.map((c) => c.toLowerCase())
  // The header is the first row that has any of the required names; failing that the first row, so the error names what is missing.
  let rowIndex = cells.findIndex((row) => row.some((cell) => wanted.includes(normal(cell))))
  if (rowIndex < 0) rowIndex = 0
  const header = (cells[rowIndex] ?? []).map(normal)
  const columns = new Map<string, number>()
  const missing: string[] = []
  for (const name of REQUIRED_COLUMNS) {
    const i = header.indexOf(name.toLowerCase())
    if (i < 0) missing.push(name)
    else columns.set(name, i)
  }
  return { rowIndex, columns, missing }
}

export function parseKpiTable(cells: unknown[][], known: KnownNames): ParseResult {
  const { rowIndex, columns, missing } = findHeader(cells)
  const result: ParseResult = { rows: [], problems: [], missingColumns: missing, blankRows: 0 }
  if (missing.length > 0) return result

  const at = (row: unknown[], name: string) => row[columns.get(name)!]
  const firstLine = new Map<string, number>()
  for (let i = rowIndex + 1; i < cells.length; i++) {
    const row = cells[i]!
    const line = i + 1
    if (row.every(isEmpty)) {
      result.blankRows++
      continue
    }
    const cultivation = textOf(at(row, 'Cultivation'))
    const kpi = textOf(at(row, 'KPI'))
    const date = readDate(at(row, 'Date'))
    const actual = readNumber(at(row, 'Actual'))
    const target = readNumber(at(row, 'Target'))

    const issues: string[] = []
    if (cultivation === '') issues.push('no cultivation')
    else if (!known.cultivations.has(cultivation)) issues.push(`unknown cultivation "${cultivation}"`)
    if (kpi === '') issues.push('no KPI')
    else if (!known.kpis.has(kpi)) issues.push(`unknown KPI "${kpi}"`)
    if (date === null) issues.push(`"${textOf(at(row, 'Date'))}" is not a date it can read`)
    if (actual === undefined) issues.push(`Actual "${textOf(at(row, 'Actual'))}" is not a number`)
    if (target === undefined) issues.push(`Target "${textOf(at(row, 'Target'))}" is not a number`)
    if (issues.length > 0) {
      result.problems.push({ line, message: `Row ${line}: ${issues.join('; ')}. Left out.` })
      continue
    }

    const key = `${cultivation}|${kpi}|${date}`
    const first = firstLine.get(key)
    if (first !== undefined) {
      result.problems.push({ line, message: `Row ${line}: ${cultivation}, ${kpi}, ${date} is already on row ${first}. Only the first one is used.` })
      continue
    }
    firstLine.set(key, line)
    result.rows.push({ line, cultivation, kpi, date: date!, actual: actual as number | null, target: target as number | null })
  }
  return result
}
