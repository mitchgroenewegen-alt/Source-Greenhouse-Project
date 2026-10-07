import { describe, expect, it } from 'vitest'
import { loadTestData } from '../test/loadData'
import { cellRef, cellText, columnLetter, daysAround, displayCellRef, FIELD_LETTER, rowOf, rowsAround, SHEET_COLUMNS, sourceIndex } from './sourceCells'

const data = loadTestData()
const index = sourceIndex(data)

describe('cell references', () => {
  it('names the 13 columns A to M, with L Actual and M Target', () => {
    expect(SHEET_COLUMNS.map((c) => c.letter).join('')).toBe('ABCDEFGHIJKLM')
    expect(SHEET_COLUMNS.find((c) => c.field === 'actual')!.letter).toBe(FIELD_LETTER.actual)
    expect(SHEET_COLUMNS.find((c) => c.field === 'target')!.letter).toBe(FIELD_LETTER.target)
  })
  it('turns an index into a column letter, past Z too', () => {
    expect([0, 11, 12, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual(['A', 'L', 'M', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
  })
  it('writes the plain reference without a separator and the displayed one with it', () => {
    expect(cellRef('L', 4213)).toBe('L4213')
    expect(displayCellRef('L', 4213)).toBe('L4,213')
    expect(displayCellRef('M', 16171)).toBe('M16,171')
    expect(displayCellRef('A', 999)).toBe('A999')
    expect(displayCellRef('A', 2)).toBe('A2')
  })
})

describe('source index and neighbourhood', () => {
  it('is built once per data file', () => {
    expect(sourceIndex(data)).toBe(index)
    expect(index.byRow.size).toBe(16170)
    expect(index.lastRow).toBe(16171)
  })

  it('finds the row of a cell and the rows around it by row number', () => {
    const row = rowOf(index, 'PA-P2-TOV', 'Temperature (24h)', '2025-08-24')!
    expect(row).toBe(4278)
    const around = rowsAround(index, row)
    expect(around.map((r) => r.row)).toEqual([4276, 4277, 4278, 4279, 4280])
    expect(around[2]!.data.kpi).toBe('Temperature (24h)')
  })

  it('stops at the first data row (row 2): the header row is not data', () => {
    expect(rowsAround(index, 2).map((r) => r.row)).toEqual([2, 3, 4])
    expect(rowsAround(index, 3).map((r) => r.row)).toEqual([2, 3, 4, 5])
  })

  it('stops at the last row (16171)', () => {
    expect(rowsAround(index, 16171).map((r) => r.row)).toEqual([16169, 16170, 16171])
  })

  it('has no neighbourhood for a missing row number', () => {
    expect(rowsAround(index, 99999)).toEqual([])
    expect(rowsAround(index, 1)).toEqual([])
    expect(rowOf(index, 'PA-P2-TOV', 'Temperature (24h)', '2030-01-01')).toBeUndefined()
    expect(rowOf(index, 'XX-NEW', 'Temperature (24h)', '2025-08-24')).toBeUndefined()
  })

  it('ignores rows without a row number', () => {
    const fake = { ...data, daily: [{ ...data.daily[0]!, row: undefined }] }
    const i = sourceIndex(fake)
    expect(i.byRow.size).toBe(0)
    expect(rowsAround(i, 2)).toEqual([])
  })

  it('lists the same KPI up to 3 days before and after, each with its own row', () => {
    const days = daysAround(index, 'PA-P2-TOV', 'Temperature (24h)', '2025-08-20')
    expect(days.map((d) => d.date)).toEqual(['2025-08-17', '2025-08-18', '2025-08-19', '2025-08-20', '2025-08-21', '2025-08-22', '2025-08-23'])
    for (const d of days) expect(index.byRow.get(d.row)!.date).toBe(d.date)
  })

  it('shortens the strip at the ends of the period and gives nothing for an unknown day', () => {
    expect(daysAround(index, 'PA-P2-TOV', 'Temperature (24h)', '2025-08-24').map((d) => d.date)).toHaveLength(4)
    expect(daysAround(index, 'PA-P2-TOV', 'Temperature (24h)', '2025-05-26').map((d) => d.date)).toHaveLength(4)
    expect(daysAround(index, 'PA-P2-TOV', 'Temperature (24h)', '2030-01-01')).toEqual([])
  })

  it('reads sheet cells back from the data: the workbook value, an empty cell as empty text', () => {
    const r = index.byRow.get(4278)!
    expect(cellText(index, r, 'actual')).toBe('21.51')
    expect(cellText(index, r, 'unit')).toBe('°C')
    expect(cellText(index, r, 'facility')).toBe('Pennsylvania')
    expect(cellText(index, { ...r, target: null }, 'target')).toBe('')
  })
})
