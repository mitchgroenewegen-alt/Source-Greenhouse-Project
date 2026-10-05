import { describe, expect, it } from 'vitest'
import { examplePricesInUse } from '../financials'
import { marketPriceLongText, marketPriceText } from '../financials/priceSource'
import { DEFAULT_FRUIT_TYPES } from '../setup/fruitTypes'
import type { FruitType, Rates } from '../workspace/types'
import { KG_PER_LB, parsePriceTable } from './priceFile'
import { changeText, previewPrices, toPriceSave, type PriceContext } from './pricePreview'
import { readTableFile } from './file'
import { itemToRow, rowToItem, tableSpec } from '../workspace/supabaseStore'
import { fruitTypeFromForm, fruitTypeFormOf } from '../setup/fruitTypes'
import { ratesRowFor, rateInputsOf } from '../financials'

const TODAY = '2026-10-05'
const header = ['Commodity', 'Price', 'Facility', 'Currency', 'Date', 'Unit']
const facilities = [
  { id: 'PA', name: 'Paarl', currency: 'USD' },
  { id: 'EU', name: 'Europe', currency: 'EUR' },
]
const ctx = (over: Partial<PriceContext> = {}): PriceContext => ({ types: DEFAULT_FRUIT_TYPES, seeded: false, facilities, rates: [], appCurrency: 'USD', ...over })
const parse = (...rows: unknown[][]) => parsePriceTable([header, ...rows], TODAY)
const NOTE_META = { importedBy: 'dana@example.com', importedAt: '2026-10-05T09:00:00.000Z' }

describe('parsePriceTable', () => {
  it('reads a row with defaults: kg, today, no facility', () => {
    const r = parsePriceTable([['Commodity', 'Price'], ['TOV', '2,8']], TODAY)
    expect(r.rows).toEqual([{ line: 2, commodity: 'TOV', facility: '', price: 2.8, unit: 'kg', pricePerKg: 2.8, currency: '', date: TODAY }])
  })
  it('converts lb to kg and reads the date, currency and facility', () => {
    const r = parse(['Cherry', 2, 'Paarl', 'usd', '2026-10-04', 'lb'])
    expect(r.rows[0]!.pricePerKg).toBeCloseTo(2 / KG_PER_LB, 4)
    expect(r.rows[0]).toMatchObject({ currency: 'USD', date: '2026-10-04', facility: 'Paarl', unit: 'lb' })
  })
  it('lists problems with row numbers', () => {
    const r = parse(['TOV', 'abc'], ['Snack', -1], ['', 3], ['Cherry', 3, '', '', 'tomorrow'], ['Plum', 3, '', '', '', 'ton'], ['Roma', ''])
    expect(r.rows).toEqual([])
    expect(r.problems.map((p) => p.line)).toEqual([2, 3, 4, 5, 6, 7])
    expect(r.problems[0]!.message).toContain('not a number')
    expect(r.problems[1]!.message).toContain('below 0')
  })
  it('matches headers loosely, skips blank rows and names missing columns', () => {
    expect(parsePriceTable([[' commodity ', 'PRICE PER KG'], [], ['TOV', 2]], TODAY)).toMatchObject({ blankRows: 1, rows: [{ line: 3 }] })
    expect(parsePriceTable([['Commodity', 'Cost'], ['TOV', 2]], TODAY).missingColumns).toEqual(['Price'])
  })
  it('reads a CSV through the shared file reader', async () => {
    const file = { name: 'p.csv', text: async () => 'Commodity,Price\nTOV,2.5\n', arrayBuffer: async () => new ArrayBuffer(0) }
    const { cells } = await readTableFile(file)
    expect(parsePriceTable(cells, TODAY).rows[0]).toMatchObject({ commodity: 'TOV', pricePerKg: 2.5 })
  })
})

describe('previewPrices', () => {
  it('matches a commodity by name or id, whatever the case', () => {
    const p = previewPrices(parse(['tov', 2.8], ['GRAPE ON THE VINE', 4.6], ['grape-on-the-vine', 5]), ctx())
    expect(p.changes.map((c) => c.typeId)).toEqual(['tov', 'grape-on-the-vine'])
    expect(p.problems.map((x) => x.message)).toEqual([expect.stringContaining('already on row 3')])
  })
  it('sets a facility override, matching the facility by name or id', () => {
    const p = previewPrices(parse(['TOV', 3, 'paarl'], ['Cherry', 6, 'PA']), ctx())
    expect(p.changes.map((c) => [c.facilityId, c.typeId])).toEqual([['PA', 'tov'], ['PA', 'cherry']])
    expect(previewPrices(parse(['TOV', 3, 'Nowhere']), ctx()).problems[0]!.message).toContain('unknown facility "Nowhere"')
  })
  it('shows old and new price with the change in percent, and skips unchanged rows', () => {
    const types: FruitType[] = DEFAULT_FRUIT_TYPES.map((t) => (t.id === 'tov' ? { ...t, pricePerKg: 2.5 } : t.id === 'snack' ? { ...t, pricePerKg: 5 } : t))
    const p = previewPrices(parse(['TOV', 2.8], ['Snack', 5], ['Cherry', 6]), ctx({ types, seeded: true }))
    expect(p.unchanged.map((r) => r.commodity)).toEqual(['Snack'])
    expect(p.changes.map((c) => changeText(c.before, c.after))).toEqual(['2.50 → 2.80 (+12.0%)', 'no price → 6.00'])
  })
  it('compares a facility row with that facility\'s override', () => {
    const rates: Rates[] = [{ facilityId: 'PA', heatPerKwh: null, electricityPerKwh: null, waterPerM3: null, priceOverrides: { tov: 3 }, updatedBy: null, updatedAt: null }]
    const p = previewPrices(parse(['TOV', 3, 'Paarl'], ['TOV', 3.3, 'Europe', 'EUR']), ctx({ rates }))
    expect(p.unchanged).toHaveLength(1)
    expect(p.changes).toHaveLength(1)
  })
  it('converts lb to kg for the change', () => {
    const p = previewPrices(parse(['TOV', 1, '', '', '', 'lb']), ctx())
    expect(p.changes[0]!.after).toBeCloseTo(2.2046, 4)
  })
  it('rejects a currency that does not match the facility or the app, accepts it when empty or equal', () => {
    const p = previewPrices(parse(['TOV', 3, 'Paarl', 'EUR'], ['Cherry', 3, 'Europe', 'EUR'], ['Snack', 3, '', 'ZAR'], ['Roma', 3, 'Europe'], ['Plum', 3, '', 'USD']), ctx())
    expect(p.problems.map((x) => x.line)).toEqual([2, 4])
    expect(p.problems[0]!.message).toContain('currency is EUR')
    expect(p.changes.map((c) => c.typeId)).toEqual(['cherry', 'roma', 'plum'])
  })
  it('uses the first of a duplicate and says so; a facility row is not a duplicate of the general one', () => {
    const p = previewPrices(parse(['TOV', 2.8], ['TOV', 9], ['TOV', 3, 'Paarl']), ctx())
    expect(p.changes.map((c) => c.after)).toEqual([2.8, 3])
    expect(p.problems).toHaveLength(1)
    expect(p.problems[0]).toMatchObject({ line: 3 })
  })
  it('lists an unknown commodity and leaves its rows out unless it is to be created', () => {
    const rows = parse(['Mini plum', 7.2], ['mini plum', 8, 'Paarl'], ['TOV', 2.8])
    const without = previewPrices(rows, ctx())
    expect(without.unknown).toEqual([{ name: 'Mini plum', key: 'mini plum', lines: [2, 3], create: false }])
    expect(without.skipped).toBe(2)
    expect(without.changes.map((c) => c.typeId)).toEqual(['tov'])

    const withIt = previewPrices(rows, ctx(), new Set(['mini plum']))
    expect(withIt.skipped).toBe(0)
    expect(withIt.unknown[0]!.create).toBe(true)
    expect(withIt.changes.map((c) => [c.typeId, c.facilityId, c.newCommodity])).toEqual([['mini-plum', null, true], ['mini-plum', 'PA', true], ['tov', null, false]])
  })
})

describe('toPriceSave', () => {
  it('prices a new commodity, notes the source, and keeps the defaults on the first save', () => {
    const rows = parse(['Mini plum', 7.2, '', '', '2026-10-04'], ['TOV', 2.8, '', '', '2026-10-04'], ['Cherry', 6.1, 'Paarl'])
    const c = ctx()
    const save = toPriceSave(previewPrices(rows, c, new Set(['mini plum'])), c, NOTE_META)
    expect(save.created).toEqual(['Mini plum'])
    expect(save.fruitTypes).toHaveLength(DEFAULT_FRUIT_TYPES.length + 1) // not seeded: all are kept
    const mini = save.fruitTypes.find((t) => t.id === 'mini-plum')!
    expect(mini).toMatchObject({ name: 'Mini plum', pricePerKg: 7.2, placeholder: true })
    expect(mini.priceSource).toEqual({ kind: 'market', date: '2026-10-04', importedBy: 'dana@example.com', importedAt: NOTE_META.importedAt })
    expect(save.fruitTypes.find((t) => t.id === 'tov')!.pricePerKg).toBe(2.8)
    expect(save.rates).toEqual([expect.objectContaining({ facilityId: 'PA', priceOverrides: { cherry: 6.1 }, updatedBy: 'dana@example.com', priceSources: { cherry: expect.objectContaining({ date: TODAY }) } })])
    expect(marketPriceText(mini.priceSource!)).toBe('Market price as of 4 Oct 2026')
    expect(marketPriceLongText(mini.priceSource!)).toBe('Market price, 4 Oct 2026, imported by dana@example.com')
  })
  it('saves only what changed when the fruit types are already the workspace\'s, and merges facility overrides', () => {
    const rates: Rates[] = [{ facilityId: 'PA', heatPerKwh: 0.1, electricityPerKwh: null, waterPerM3: 2, priceOverrides: { beef: 2.4 }, updatedBy: null, updatedAt: null }]
    const c = ctx({ seeded: true, rates })
    const save = toPriceSave(previewPrices(parse(['TOV', 2.8], ['Snack', 5.2, 'Paarl']), c), c, NOTE_META)
    expect(save.fruitTypes.map((t) => t.id)).toEqual(['tov'])
    expect(save.rates[0]).toMatchObject({ heatPerKwh: 0.1, waterPerM3: 2, priceOverrides: { beef: 2.4, snack: 5.2 } })
    expect(save.created).toEqual([])
  })
  it('saves nothing for a file with no change', () => {
    const c = ctx()
    const save = toPriceSave(previewPrices(parse(['Nothing', 2]), c), c, NOTE_META)
    expect(save).toEqual({ fruitTypes: [], rates: [], created: [] })
  })
  it('switches the example prices off', () => {
    const c = ctx()
    expect(examplePricesInUse(c.types, c.rates)).toBe(true)
    const save = toPriceSave(previewPrices(parse(['TOV', 2.8]), c), c, NOTE_META)
    expect(examplePricesInUse(save.fruitTypes, c.rates)).toBe(false)
    const onlyFacility = toPriceSave(previewPrices(parse(['TOV', 2.8, 'Paarl']), c), c, NOTE_META)
    expect(examplePricesInUse(c.types, onlyFacility.rates)).toBe(false)
  })
})

describe('where a price came from', () => {
  const note = { kind: 'market' as const, date: '2026-10-04', importedBy: 'dana@example.com', importedAt: '2026-10-05T09:00:00.000Z' }
  it('is stored in the price_source columns and comes back', () => {
    const type: FruitType = { ...DEFAULT_FRUIT_TYPES[0]!, pricePerKg: 6, priceSource: note }
    expect(itemToRow(tableSpec('fruitTypes'), type)).toMatchObject({ price_source: note })
    expect(rowToItem(tableSpec('fruitTypes'), itemToRow(tableSpec('fruitTypes'), type))).toEqual(type)
    const rates: Rates = { facilityId: 'PA', heatPerKwh: null, electricityPerKwh: null, waterPerM3: null, priceOverrides: { tov: 3 }, priceSources: { tov: note }, updatedBy: null, updatedAt: null }
    expect(itemToRow(tableSpec('rates'), rates)).toMatchObject({ price_sources: { tov: note } })
    expect(rowToItem(tableSpec('rates'), itemToRow(tableSpec('rates'), rates))).toEqual(rates)
  })
  it('is kept while the price is the imported one and dropped when someone types another', () => {
    const type: FruitType = { ...DEFAULT_FRUIT_TYPES[0]!, pricePerKg: 6, priceSource: note }
    expect(fruitTypeFromForm(type.id, fruitTypeFormOf(type), false, type).priceSource).toEqual(note)
    expect(fruitTypeFromForm(type.id, { ...fruitTypeFormOf(type), pricePerKg: '6.5' }, false, type).priceSource).toBeUndefined()
    const rates: Rates = { facilityId: 'PA', heatPerKwh: null, electricityPerKwh: null, waterPerM3: null, priceOverrides: { tov: 3, cherry: 6 }, priceSources: { tov: note, cherry: note }, updatedBy: null, updatedAt: null }
    const input = { ...rateInputsOf(rates), prices: { tov: '3', cherry: '6.2' } }
    expect(ratesRowFor('PA', input, 'x', new Date(), rates).priceSources).toEqual({ tov: note })
  })
})
