// Where a value sits in the original workbook: its cell, the rows around it, and the same KPI on the days around it.
// Everything is built from the static data file (rows carry their Excel row number), never from workspace edits, so
// the values are the workbook's own.

import type { Cultivation, DailyRow, DataFile, KpiDictionaryEntry } from './types'

export const SOURCE_SHEET = 'KPIs'

export type SheetField = 'date' | 'week' | 'company' | 'facility' | 'greenhouse' | 'cultivation' | 'crop' | 'variety' | 'category' | 'kpi' | 'unit' | 'actual' | 'target'

/** The 13 columns of the KPIs sheet, in order: A Date ... M Target. */
export const SHEET_COLUMNS: { letter: string; header: string; field: SheetField; shownByDefault: boolean }[] = (
  [
    ['Date', 'date', true],
    ['ISO week', 'week', false],
    ['Company', 'company', false],
    ['Facility', 'facility', false],
    ['Greenhouse', 'greenhouse', false],
    ['Cultivation', 'cultivation', true],
    ['Crop', 'crop', false],
    ['Variety', 'variety', false],
    ['KPI category', 'category', false],
    ['KPI', 'kpi', true],
    ['Unit', 'unit', true],
    ['Actual', 'actual', true],
    ['Target', 'target', true],
  ] as const
).map(([header, field, shownByDefault], i) => ({ letter: columnLetter(i), header, field, shownByDefault }))

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function columnLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** The reference as Excel writes it: "L4213". */
export function cellRef(letter: string, row: number): string {
  return `${letter}${row}`
}

/** The reference as shown to people: the row gets a thousands separator, "L4,213". */
export function displayCellRef(letter: string, row: number): string {
  return `${letter}${row.toLocaleString('en-US')}`
}

/** The column a flagged field lives in. */
export const FIELD_LETTER = { actual: 'L', target: 'M' } as const

export interface SourceRow {
  row: number
  data: DailyRow
}

/** One day of a series (one cultivation and KPI), with the row it has in the sheet. */
export interface SeriesDay {
  date: string
  row: number
  actual: number | null
  target: number | null
}

export interface SourceIndex {
  byRow: Map<number, DailyRow>
  /** The last row number that holds data. */
  lastRow: number
  /** Workbook days of each cultivation and KPI, oldest first. */
  series: Map<string, SeriesDay[]>
  cultivations: Map<string, Cultivation>
  kpis: Map<string, KpiDictionaryEntry>
}

const seriesKey = (cultivation: string, kpi: string) => `${cultivation}|${kpi}`
const cache = new WeakMap<DataFile, SourceIndex>()

/** Built once per data file (memoised): rows by number and the days of each series. */
export function sourceIndex(workbook: DataFile): SourceIndex {
  const hit = cache.get(workbook)
  if (hit) return hit
  const byRow = new Map<number, DailyRow>()
  const series = new Map<string, SeriesDay[]>()
  let lastRow = 1
  for (const r of workbook.daily) {
    if (r.row === undefined) continue
    byRow.set(r.row, r)
    if (r.row > lastRow) lastRow = r.row
    const key = seriesKey(r.cultivation, r.kpi)
    const days = series.get(key)
    const day = { date: r.date, row: r.row, actual: r.actual, target: r.target }
    if (days) days.push(day)
    else series.set(key, [day])
  }
  for (const days of series.values()) days.sort((a, b) => a.date.localeCompare(b.date))
  const index: SourceIndex = {
    byRow,
    lastRow,
    series,
    cultivations: new Map(workbook.cultivations.map((c) => [c.id, c])),
    kpis: new Map(workbook.kpis.map((k) => [k.name, k])),
  }
  cache.set(workbook, index)
  return index
}

/** The workbook row of a cultivation, KPI and day; undefined when the workbook has none (typed in, imported, or a new cultivation). */
export function rowOf(index: SourceIndex, cultivation: string, kpi: string, date: string): number | undefined {
  return index.series.get(seriesKey(cultivation, kpi))?.find((d) => d.date === date)?.row
}

/** The flagged row plus `radius` rows above and below, by row number. Rows before the first data row (2) and after the last are left out. */
export function rowsAround(index: SourceIndex, row: number, radius = 2): SourceRow[] {
  if (!index.byRow.has(row)) return []
  const out: SourceRow[] = []
  for (let r = Math.max(2, row - radius); r <= Math.min(index.lastRow, row + radius); r++) {
    const data = index.byRow.get(r)
    if (data) out.push({ row: r, data })
  }
  return out
}

/** The same cultivation and KPI: up to `count` recorded days before and after the flagged one, and the flagged day itself. */
export function daysAround(index: SourceIndex, cultivation: string, kpi: string, date: string, count = 3): SeriesDay[] {
  const days = index.series.get(seriesKey(cultivation, kpi)) ?? []
  const at = days.findIndex((d) => d.date === date)
  if (at < 0) return []
  return days.slice(Math.max(0, at - count), at + count + 1)
}

/** What a sheet cell holds for a row, as text ('' for an empty cell). Company is the same on every row and is not kept in the data file, so it is not shown. */
export function cellText(index: SourceIndex, data: DailyRow, field: SheetField): string {
  const cultivation = index.cultivations.get(data.cultivation)
  switch (field) {
    case 'date':
      return data.date
    case 'week':
      return data.week
    case 'company':
      return ''
    case 'facility':
      return cultivation?.facility ?? ''
    case 'greenhouse':
      return cultivation?.greenhouse ?? ''
    case 'cultivation':
      return data.cultivation
    case 'crop':
      return cultivation?.crop ?? ''
    case 'variety':
      return cultivation?.variety ?? ''
    case 'category':
      return index.kpis.get(data.kpi)?.category ?? ''
    case 'kpi':
      return data.kpi
    case 'unit':
      return index.kpis.get(data.kpi)?.unit ?? ''
    case 'actual':
      return data.actual === null ? '' : String(data.actual)
    case 'target':
      return data.target === null ? '' : String(data.target)
  }
}
