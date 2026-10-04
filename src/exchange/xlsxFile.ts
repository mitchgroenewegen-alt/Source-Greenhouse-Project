// The only place that loads SheetJS. It is imported with import() inside the functions, so the library (about 400 kB) is a
// separate chunk that is fetched when someone imports or exports, and not part of the app everyone opens.

import { isoToExcelSerial } from '../data/dates'
import { isDateCell, type SheetSpec } from './sheets'

type SheetJs = typeof import('xlsx')

async function loadSheetJs(): Promise<SheetJs> {
  const mod = await import('xlsx')
  // Depending on how the bundler wraps the library, the functions are on the module or on its default export.
  return ((mod as { default?: SheetJs }).default ?? mod) as SheetJs
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const DATE_FORMAT = 'yyyy-mm-dd'
const DEFAULT_WIDTH = 14
/** Excel does not allow more than 31 characters in a sheet name, nor these characters. */
const sheetName = (name: string) => name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)

/** The workbook as .xlsx bytes. */
export async function writeWorkbook(sheets: SheetSpec[]): Promise<Uint8Array> {
  const XLSX = await loadSheetJs()
  const book = XLSX.utils.book_new()
  for (const spec of sheets) {
    const rows = spec.rows.map((row) =>
      row.map((cell) => (isDateCell(cell) ? { t: 'n' as const, v: isoToExcelSerial(cell.date), z: DATE_FORMAT } : cell)),
    )
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    const columns = Math.max(0, ...spec.rows.map((r) => r.length))
    sheet['!cols'] = Array.from({ length: columns }, (_, i) => ({ wch: spec.widths?.[i] ?? DEFAULT_WIDTH }))
    XLSX.utils.book_append_sheet(book, sheet, sheetName(spec.name))
  }
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer)
}

/** The cells of every sheet of an .xlsx file, by sheet name. Dates stay Excel day counts and empty cells are null. */
export async function readWorkbook(bytes: ArrayBuffer | Uint8Array): Promise<{ name: string; cells: unknown[][] }[]> {
  const XLSX = await loadSheetJs()
  const book = XLSX.read(bytes, { type: 'array' })
  return book.SheetNames.map((name) => ({
    name,
    cells: XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name]!, { header: 1, raw: true, defval: null }),
  }))
}
