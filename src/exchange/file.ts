// Reads a file someone picked for an import into rows of cells. A CSV is read here (no library); an .xlsx with SheetJS,
// loaded only then. Which sheet is read: the one called "KPIs" (the workbook and the app's own export have it), else the
// only sheet, else the first one that has the columns an import needs.

import { parseCsvRows } from '../storage/csv'
import { findHeader } from './parse'
import { readWorkbook } from './xlsxFile'

/** A file as far as reading goes (a browser File fits). */
export interface PickedFile {
  name: string
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
}

/** Something the person can fix: the message is written for them. */
export class ImportFileError extends Error {}

export interface TableRead {
  cells: unknown[][]
  /** The sheet that was read; null for a CSV. */
  sheet: string | null
}

/** What an import needs from an .xlsx: the sheet to prefer by name, how to tell a sheet has the columns, and what to say when none does. */
export interface TableKind {
  sheetName: string
  hasColumns: (cells: unknown[][]) => boolean
  noSheetMessage: string
}

/** The KPIs table: the workbook and the app's own export have a sheet called "KPIs". */
export const KPI_TABLE: TableKind = {
  sheetName: 'kpis',
  hasColumns: (cells) => findHeader(cells).missing.length === 0,
  noSheetMessage: 'There is no sheet called "KPIs" in this workbook, and no other sheet has the columns Date, Cultivation, KPI, Actual and Target.',
}

export async function readTableFile(file: PickedFile, kind: TableKind = KPI_TABLE): Promise<TableRead> {
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (extension === 'csv') return { cells: parseCsvRows(await file.text()), sheet: null }
  if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'xlsm') throw new ImportFileError('Choose an Excel file (.xlsx) or a CSV file (.csv).')

  let sheets: Awaited<ReturnType<typeof readWorkbook>>
  try {
    sheets = await readWorkbook(await file.arrayBuffer())
  } catch {
    throw new ImportFileError('That file could not be read as an Excel workbook. Is it damaged, or protected with a password?')
  }
  const named = sheets.find((s) => s.name.trim().toLowerCase() === kind.sheetName)
  const picked = named ?? (sheets.length === 1 ? sheets[0] : sheets.find((s) => kind.hasColumns(s.cells)))
  if (!picked) throw new ImportFileError(kind.noSheetMessage)
  return { cells: picked.cells, sheet: picked.name }
}
