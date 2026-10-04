// The shape of a spreadsheet as the export builds it, before SheetJS turns it into a file. Keeping it plain means the
// builders can be tested without a file, and SheetJS is only loaded when someone really exports (see xlsxFile.ts).

/** A day, written as a real date (with a date format) so a spreadsheet can sort and filter on it. */
export interface DateCell {
  date: string
}

export type Cell = string | number | boolean | null | DateCell

export interface SheetSpec {
  name: string
  rows: Cell[][]
  /** Column widths in characters, left to right; the rest get a default. */
  widths?: number[]
}

export const isDateCell = (cell: Cell): cell is DateCell => typeof cell === 'object' && cell !== null

/** A number for a cell, or empty when there is none (or it is infinite, as a variance against a zero budget is). */
export const numberCell = (value: number | null | undefined): number | null => (value === null || value === undefined || !Number.isFinite(value) ? null : value)

export const yesNo = (value: boolean) => (value ? 'Yes' : 'No')
