import { describe, expect, it } from 'vitest'
import { pointOfData } from '../forecast'
import { buildCatalog } from '../setup/catalog'
import { DEFAULT_FRUIT_TYPES } from '../setup/fruitTypes'
import { loadTestData } from '../test/loadData'
import type { FruitType, Rates } from '../workspace/types'
import {
  buildFinancials,
  costsAndMargin,
  effectsOf,
  examplePricesInUse,
  PLACEHOLDER_LED_W_PER_M2,
  priceOf,
  ratesRowFor,
  validateRates,
  wasteKgPerM2,
  weekLines,
  type FinancialsInput,
} from './index'
import type { ValueOf } from './calc'

const data = loadTestData()
const weekIds = data.weeks.map((w) => w.id)
const lookup = pointOfData(data)
const point: FinancialsInput['point'] = (c, kpi, w) => {
  const p = lookup(c, kpi, w)
  return p && { actual: p.actual, target: p.target, paired: p.actual !== null && p.target !== null }
}
const catalog = buildCatalog(data.cultivations, { facilities: [], greenhouses: [] })
const withPrice = (id: string, price: number | null): FruitType[] => DEFAULT_FRUIT_TYPES.map((t) => (t.id === id ? { ...t, pricePerKg: price } : t))
const rates = (over: Partial<Rates> = {}): Rates => ({ facilityId: 'PA', heatPerKwh: 0.05, electricityPerKwh: 0.1, waterPerM3: 2, priceOverrides: null, updatedBy: null, updatedAt: null, ...over })

function financials(fruitTypes: FruitType[], rateRows: Rates[] = [], week = '2025-W34') {
  return buildFinancials({ cultivations: data.cultivations, weeks: weekIds, week, point, fruitTypes, rates: rateRows, catalog, forecasts: new Map() })
}
const pa = (f: ReturnType<typeof financials>) => f.cultivations.find((c) => c.cultivation.id === 'PA-P1-TOV')!

/** A constant week for hand calculations: 1 kg/m² harvested against a budget of 2, area 1000 m². */
const inputs = { areaM2: 1000, ledWattsPerM2: 100, price: 3, heatPerKwh: 0.05, electricityPerKwh: 0.1, waterPerM3: 2 }
const values = (v: Record<string, [number | null, number | null]>): ValueOf => (kpi) => {
  const pair = v[kpi]
  return pair ? { actual: pair[0], target: pair[1], paired: pair[0] !== null && pair[1] !== null } : undefined
}

describe('revenue', () => {
  it('PA-P1-TOV week 34 at 3.00 USD/kg is harvest x 98,400 m² x 3.00', () => {
    const f = pa(financials(withPrice('tov', 3)))
    const harvest = data.weekly.find((w) => w.cultivation === 'PA-P1-TOV' && w.kpi === 'Harvest' && w.week === '2025-W34')!
    expect(f.cultivation.areaM2).toBe(98400)
    expect(f.price).toMatchObject({ value: 3, source: 'fruit-type' })
    expect(f.week.revenue.actual).toBeCloseTo(harvest.actual! * 98400 * 3, 6)
    expect(f.week.revenue.budget).toBeCloseTo(harvest.target! * 98400 * 3, 6)
    expect(f.week.revenue.actual).toBeCloseTo(554976, 6) // 1.88 x 98,400 x 3.00
  })

  it('does not take waste off a second time: harvest is already net', () => {
    const lines = weekLines(inputs, values({ Harvest: [1, 2], Waste: [10, 10] }), 'w')
    expect(lines.revenue.actual).toBe(1 * 1000 * 3)
    expect(lines.revenue.budget).toBe(2 * 1000 * 3)
  })

  it('adds the weeks up to date', () => {
    const f = pa(financials(withPrice('tov', 3)))
    const weekly = weekIds.map((w) => point('PA-P1-TOV', 'Harvest', w)).filter((p) => p?.paired)
    expect(f.toDate.revenue.actual).toBeCloseTo(weekly.reduce((s, p) => s + p!.actual! * 98400 * 3, 0), 4)
  })
})

describe('value lost to waste', () => {
  it('is harvest x w / (1 - w): 3 % of what was picked is waste, so 3/97 of the net harvest', () => {
    expect(wasteKgPerM2(1.94, 3)).toBeCloseTo((1.94 * 0.03) / 0.97, 12)
    expect(wasteKgPerM2(97, 3)).toBeCloseTo(3, 12) // 100 picked, 97 sold, 3 lost
  })
  it('is empty without a waste figure or with an impossible one', () => {
    expect(wasteKgPerM2(1.9, null)).toBeNull()
    expect(wasteKgPerM2(null, 3)).toBeNull()
    expect(wasteKgPerM2(1, 100)).toBeNull()
  })
  it('is valued at the same price, area and budget logic as the revenue', () => {
    const lines = weekLines(inputs, values({ Harvest: [97, 100], Waste: [3, 5] }), 'w')
    expect(lines.wasteValue.actual).toBeCloseTo(3 * 1000 * 3, 6)
    expect(lines.wasteValue.budget).toBeCloseTo(((100 * 0.05) / 0.95) * 1000 * 3, 6)
  })
})

describe('energy and water cost', () => {
  const lines = weekLines(inputs, values({ 'Heating energy (approx.)': [8, 7], 'LED lighting': [10, 12], 'Irrigation water': [15, null] }), 'w')
  it('heat is kWh/m² x area x price per kWh', () => {
    expect(lines.heat.actual).toBeCloseTo(8 * 1000 * 0.05, 9)
    expect(lines.heat.budget).toBeCloseTo(7 * 1000 * 0.05, 9)
  })
  it('LED is hours x installed W/m² / 1000 x area x electricity price', () => {
    expect(lines.led.actual).toBeCloseTo(10 * (100 / 1000) * 1000 * 0.1, 9)
    expect(lines.led.budget).toBeCloseTo(12 * (100 / 1000) * 1000 * 0.1, 9)
  })
  it('water is L/m² / 1000 x area x price per m³', () => {
    expect(lines.water.actual).toBeCloseTo((15 / 1000) * 1000 * 2, 9)
  })
  it('irrigation water has no budget cost without a target', () => {
    expect(lines.water.budget).toBeNull()
    const f = pa(financials(withPrice('tov', 3), [rates()]))
    expect(f.week.water.actual).not.toBeNull()
    expect(f.week.water.budget).toBeNull()
    expect(f.toDate.water.budget).toBeNull()
    // LED has no budget in this week either, so the cost with nothing to compare with is water plus LED
    expect(f.week.costs.uncompared).toBeCloseTo(f.week.water.actual! + (f.week.led.budget === null ? (f.week.led.actual ?? 0) : 0), 9)
    // ...and it appears once a target is entered
    const withTarget = weekLines(inputs, values({ 'Irrigation water': [15, 14] }), 'w')
    expect(withTarget.water.budget).toBeCloseTo((14 / 1000) * 1000 * 2, 9)
  })
  it('a missing input makes the figure missing, never zero', () => {
    const none = weekLines(inputs, values({ 'Heating energy (approx.)': [null, 7] }), 'w')
    expect(none.heat.actual).toBeNull()
    expect(none.heat.budget).toBeNull() // not paired
    expect(weekLines({ ...inputs, price: null }, values({ Harvest: [1, 2] }), 'w').revenue.actual).toBeNull()
  })
})

describe('partial margin and the gap to budget', () => {
  const line = { actual: 4000, budget: 6000 }
  const components = [{ actual: 400, budget: 350 }, { actual: 90, budget: 120 }, { actual: 30, budget: null }]
  const result = costsAndMargin(line, components)
  it('margin is revenue minus heat, LED and water', () => {
    expect(result.margin.actual).toBe(4000 - 400 - 90 - 30)
    expect(result.margin.budget).toBe(6000 - 350 - 120) // water has no budget
  })
  it('volume effect + cost effect equals the whole gap (like for like, water left out)', () => {
    const e = result.effects!
    expect(e.volume).toBe(-2000)
    expect(e.cost).toBe(470 - 490)
    expect(e.volume + e.cost!).toBe(e.gap)
    expect(e.gap).toBe(4000 - 490 - (6000 - 470))
    expect(result.costs.uncompared).toBe(30)
  })
  it('sums to the gap on real data, for every cultivation and for the facility', () => {
    const f = financials(withPrice('tov', 3), [rates()])
    for (const c of f.cultivations) {
      for (const p of [c.week, c.toDate]) {
        if (!p.effects) continue
        const comparedMargin = p.revenue.actual! - p.costs.actualCompared! - (p.revenue.budget! - p.costs.budget!)
        expect(p.effects.volume + p.effects.cost!).toBeCloseTo(p.effects.gap, 6)
        expect(p.effects.gap).toBeCloseTo(comparedMargin, 6)
      }
    }
    const facility = f.facilities[0]!
    if (facility.week.effects) expect(facility.week.effects.volume + facility.week.effects.cost!).toBeCloseTo(facility.week.effects.gap, 6)
  })
  it('has no split without a budget on either side', () => {
    expect(effectsOf({ actual: 1, budget: null }, { budget: 1, actualCompared: 1 })).toBeNull()
    expect(effectsOf({ actual: 1, budget: 2 }, { budget: null, actualCompared: null })).toBeNull()
  })
})

describe('prices', () => {
  const tov = { variety: 'TOV', fruitType: null }
  it("a facility's own price beats the fruit type's price", () => {
    const types = withPrice('tov', 3)
    expect(priceOf(tov, undefined, types, false)).toMatchObject({ value: 3, source: 'fruit-type' })
    expect(priceOf(tov, { priceOverrides: { tov: 3.4 } }, types, false)).toMatchObject({ value: 3.4, source: 'facility' })
    const f = pa(financials(types, [rates({ priceOverrides: { tov: 3.4 } })]))
    expect(f.price.source).toBe('facility')
    expect(f.week.revenue.actual).toBeCloseTo(1.88 * 98400 * 3.4, 6)
  })
  it('the override only applies to its own facility', () => {
    const f = financials(withPrice('tov', 3), [rates({ priceOverrides: { tov: 3.4 } })])
    expect(f.cultivations.find((c) => c.cultivation.id === 'ON-P1-TOV')!.price).toMatchObject({ value: 3, source: 'fruit-type' })
  })
  it('example prices are used, and flagged, until a price is entered', () => {
    expect(examplePricesInUse(DEFAULT_FRUIT_TYPES, [])).toBe(true)
    const before = financials(DEFAULT_FRUIT_TYPES)
    expect(before.examplePrices).toBe(true)
    expect(pa(before).price.source).toBe('example')
    expect(pa(before).week.revenue.actual).not.toBeNull()
  })
  it('the example flag turns off after a price is changed, on a fruit type or as an override', () => {
    expect(examplePricesInUse(withPrice('tov', 3), [])).toBe(false)
    expect(examplePricesInUse(DEFAULT_FRUIT_TYPES, [rates({ priceOverrides: { tov: 3 } })])).toBe(false)
    expect(examplePricesInUse(DEFAULT_FRUIT_TYPES, [rates({ priceOverrides: {} })])).toBe(true)
    const after = financials(withPrice('tov', 3))
    expect(after.examplePrices).toBe(false)
    // a fruit type still without a price then has no revenue rather than an invented one
    const cherry = after.cultivations.find((c) => c.cultivation.id === 'ON-P1-Cherry')!
    expect(cherry.price).toMatchObject({ value: null, source: 'none' })
    expect(cherry.week.revenue.actual).toBeNull()
  })
})

describe('rates and LED power', () => {
  it('uses the example rates, marked, until rates are entered', () => {
    const f = financials(withPrice('tov', 3))
    expect(f.exampleRatesFor).toContain('Pennsylvania')
    expect(financials(withPrice('tov', 3), [rates()]).exampleRatesFor).not.toContain('Pennsylvania')
  })
  it('uses a marked placeholder for the LED power of a greenhouse without one', () => {
    const f = financials(withPrice('tov', 3))
    expect(pa(f).led).toEqual({ wattsPerM2: PLACEHOLDER_LED_W_PER_M2, placeholder: true })
    const own = buildFinancials({ cultivations: data.cultivations, weeks: weekIds, week: '2025-W34', point, fruitTypes: withPrice('tov', 3), rates: [], catalog: buildCatalog(data.cultivations, { facilities: [], greenhouses: [{ id: 'PA-P1', facilityId: 'PA', name: 'Phase 1', areaM2: 98400, ledWattsPerM2: 120 }] }), forecasts: new Map() })
    expect(own.cultivations.find((c) => c.cultivation.id === 'PA-P1-TOV')!.led).toEqual({ wattsPerM2: 120, placeholder: false })
  })
})

describe('the rates form', () => {
  it('turns typed text into a row with who and when, and empty prices into no override', () => {
    const row = ratesRowFor('PA', { heatPerKwh: '0.05', electricityPerKwh: '', waterPerM3: '1.8', prices: { tov: '3.2', cherry: ' ' } }, 'dana@example.com', new Date('2025-09-01T10:00:00Z'))
    expect(row).toEqual({ facilityId: 'PA', heatPerKwh: 0.05, electricityPerKwh: null, waterPerM3: 1.8, priceOverrides: { tov: 3.2 }, updatedBy: 'dana@example.com', updatedAt: '2025-09-01T10:00:00.000Z' })
  })
  it('rejects negative and non-numeric entries', () => {
    expect(Object.keys(validateRates({ heatPerKwh: '-1', electricityPerKwh: 'abc', waterPerM3: '', prices: { tov: '-2' } })).sort()).toEqual(['electricityPerKwh', 'heatPerKwh', 'price:tov'])
  })
})
