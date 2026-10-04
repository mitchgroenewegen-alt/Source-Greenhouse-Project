import { describe, expect, it } from 'vitest'
import { detectFlags } from '../flags'
import { buildExport, type ExportInput } from '../exchange/exportBook'
import { applyDecisions, buildWeekly, weeklyKey } from '../scoring/effective'
import { DEFAULT_FRUIT_TYPES } from '../setup/fruitTypes'
import { loadTestData } from '../test/loadData'
import { merge } from '../workspace/merge'
import { emptyWorkspace, type WorkspaceData } from '../workspace/types'

const base = loadTestData()

function input(workspace: WorkspaceData): ExportInput {
  const merged = merge(base, workspace)
  const flags = detectFlags(merged.daily, merged.cultivations)
  const lookup = buildWeekly(applyDecisions(merged.daily, flags, [], false))
  return { now: new Date(2025, 8, 3), who: 'dana@example.com', workbook: base, merged, workspace, flags, decisions: [], point: (c, k, w) => lookup.get(weeklyKey(c, k, w)) }
}

describe('the Financials sheet of the export', () => {
  const workspace: WorkspaceData = {
    ...emptyWorkspace(),
    fruitTypes: DEFAULT_FRUIT_TYPES.map((t) => (t.id === 'tov' ? { ...t, pricePerKg: 3 } : t)),
    rates: [{ facilityId: 'PA', heatPerKwh: 0.05, electricityPerKwh: 0.1, waterPerM3: 2, priceOverrides: { cherry: 4.5 }, updatedBy: 'dana@example.com', updatedAt: '2025-09-01T10:00:00.000Z' }],
  }
  const sheets = buildExport(input(workspace))
  const financials = sheets.find((s) => s.name === 'Financials')!

  it('has a row per cultivation and week, with PA-P1-TOV week 34 at 3.00 USD/kg', () => {
    expect(financials.rows).toHaveLength(1 + base.cultivations.length * base.weeks.length)
    const header = financials.rows[0]!
    const row = financials.rows.find((r) => r[0] === 'PA-P1-TOV' && r[2] === '2025-W34')!
    expect(row[header.indexOf('Price per kg')]).toBe(3)
    expect(row[header.indexOf('Week: revenue (actual)')] as number).toBeCloseTo(1.88 * 98400 * 3, 6)
    expect(row[header.indexOf('Example prices')]).toBe('No')
    expect(row[header.indexOf('LED power is a placeholder')]).toBe('Yes')
  })

  it('puts the rates on the Settings sheet', () => {
    const settings = sheets.find((s) => s.name === 'Settings')!.rows
    const pa = settings.find((r) => r[0] === 'PA')!
    expect(pa.slice(3, 7)).toEqual([0.05, 0.1, 2, 'Cherry: 4.5'])
    expect(pa[7]).toBe('dana@example.com')
  })
})
