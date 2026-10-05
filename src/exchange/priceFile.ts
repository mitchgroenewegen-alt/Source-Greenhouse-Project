// Reads the rows of a market price file (Commodity, Price, and optionally Facility, Currency, Date, Unit) and lists what
// could not be read. Pure functions; reading the file is in file.ts and what the rows would change is in pricePreview.ts.

import type { TableKind } from './file'
import { readDate, readNumber, type ImportProblem } from './parse'

/** The columns a price file needs, and the ones it may have. */
export const PRICE_REQUIRED = ['Commodity', 'Price'] as const
export const PRICE_OPTIONAL = ['Facility', 'Currency', 'Date', 'Unit'] as const
export const PRICE_COLUMNS = [...PRICE_REQUIRED, ...PRICE_OPTIONAL]

export const KG_PER_LB = 0.45359237

export interface PriceRow {
  /** The row number in the file, counting the header as 1, so it matches what the spreadsheet shows. */
  line: number
  commodity: string
  /** Facility name or id as written; empty means the general price of the commodity. */
  facility: string
  /** The price as written, in the unit of the row. */
  price: number
  unit: 'kg' | 'lb'
  /** The price per kg: the price, converted from lb when the unit says so. */
  pricePerKg: number
  /** Upper case, as written; empty when the file gives none (the facility's or the app's currency is meant). */
  currency: string
  /** The date the price is for (YYYY-MM-DD): the Date column, else the day of the import. */
  date: string
}

export interface PriceParseResult {
  rows: PriceRow[]
  problems: ImportProblem[]
  missingColumns: string[]
  blankRows: number
}

const ALIASES: Record<string, string[]> = {
  Commodity: ['commodity', 'fruit type', 'fruit', 'product'],
  Price: ['price', 'price per kg', 'price (per kg)', 'price/kg', 'price per unit'],
  Facility: ['facility', 'site'],
  Currency: ['currency'],
  Date: ['date', 'price date', 'as of'],
  Unit: ['unit', 'price unit'],
}

const isEmpty = (cell: unknown) => cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '')
const textOf = (cell: unknown) => (isEmpty(cell) ? '' : String(cell).trim())
const normal = (cell: unknown) => textOf(cell).toLowerCase()

function headerOf(cells: unknown[][]): { rowIndex: number; columns: Map<string, number>; missing: string[] } {
  const known = Object.values(ALIASES).flat()
  let rowIndex = cells.findIndex((row) => row.some((cell) => known.includes(normal(cell))))
  if (rowIndex < 0) rowIndex = 0
  const header = (cells[rowIndex] ?? []).map(normal)
  const columns = new Map<string, number>()
  for (const [name, names] of Object.entries(ALIASES)) {
    const i = header.findIndex((h) => names.includes(h))
    if (i >= 0) columns.set(name, i)
  }
  return { rowIndex, columns, missing: PRICE_REQUIRED.filter((name) => !columns.has(name)) }
}

/** What an .xlsx must have for readTableFile to pick the sheet: the sheet called "Prices", the only sheet, or the first with the columns. */
export const PRICE_TABLE: TableKind = {
  sheetName: 'prices',
  hasColumns: (cells) => headerOf(cells).missing.length === 0,
  noSheetMessage: 'There is no sheet called "Prices" in this workbook, and no other sheet has the columns Commodity and Price.',
}

/** The unit of a row: empty means kg. null when it is none the import knows. */
function readUnit(text: string): 'kg' | 'lb' | null {
  const unit = text.toLowerCase().replace(/[./\s]/g, '')
  if (unit === '' || unit === 'kg' || unit === 'kgs' || unit === 'kilo' || unit === 'kilos' || unit === 'kilogram' || unit === 'kilograms') return 'kg'
  if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') return 'lb'
  return null
}

const round4 = (n: number) => Math.round(n * 10000) / 10000

/**
 * Read the price rows. Nothing is guessed: a row with no commodity, a price that is empty, not a number or below 0, a date it
 * cannot read or a unit it does not know is a problem and is left out. `today` is the date of a row that gives none.
 */
export function parsePriceTable(cells: unknown[][], today: string): PriceParseResult {
  const { rowIndex, columns, missing } = headerOf(cells)
  const result: PriceParseResult = { rows: [], problems: [], missingColumns: missing, blankRows: 0 }
  if (missing.length > 0) return result

  const at = (row: unknown[], name: string) => (columns.has(name) ? row[columns.get(name)!] : undefined)
  for (let i = rowIndex + 1; i < cells.length; i++) {
    const row = cells[i]!
    const line = i + 1
    if (row.every(isEmpty)) {
      result.blankRows++
      continue
    }
    const commodity = textOf(at(row, 'Commodity'))
    const price = readNumber(at(row, 'Price'))
    const unitText = textOf(at(row, 'Unit'))
    const unit = readUnit(unitText)
    const date = isEmpty(at(row, 'Date')) ? today : readDate(at(row, 'Date'))

    const issues: string[] = []
    if (commodity === '') issues.push('no commodity')
    if (price === null) issues.push('no price')
    else if (price === undefined) issues.push(`Price "${textOf(at(row, 'Price'))}" is not a number`)
    else if (price < 0) issues.push(`Price ${price} is below 0`)
    if (unit === null) issues.push(`unit "${unitText}" is not kg or lb`)
    if (date === null) issues.push(`"${textOf(at(row, 'Date'))}" is not a date it can read`)
    if (issues.length > 0) {
      result.problems.push({ line, message: `Row ${line}: ${issues.join('; ')}. Left out.` })
      continue
    }

    const given = price as number
    result.rows.push({
      line,
      commodity,
      facility: textOf(at(row, 'Facility')),
      price: given,
      unit: unit!,
      pricePerKg: unit === 'lb' ? round4(given / KG_PER_LB) : given,
      currency: textOf(at(row, 'Currency')).toUpperCase(),
      date: date!,
    })
  }
  return result
}
