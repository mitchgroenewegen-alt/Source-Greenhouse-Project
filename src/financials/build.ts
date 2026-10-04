// Puts the pieces together: for each cultivation its price, rates and LED power, the money of the selected week and to date, the forecast
// revenue; then a row per facility and one for all of them.

import type { Cultivation } from '../data/types'
import { facilityCardId } from '../components/facilities/facilitySummary'
import type { CultivationForecast, Range } from '../forecast'
import type { Catalog } from '../setup/catalog'
import { greenhouseOf } from '../setup/catalog'
import type { FruitType, Rates } from '../workspace/types'
import { addRanges, costsAndMargin, forecastMoney, periodFrom, sumLines, weekLines, type ValueOf, type WeekLines } from './calc'
import { PLACEHOLDER_LED_W_PER_M2 } from './defaults'
import { examplePricesInUse, priceOf, ratesOf } from './prices'
import type { CultivationFinancials, FacilityFinancials, Financials, Period } from './types'

export const ALL_FACILITIES_LABEL = 'All facilities'

export interface FinancialsInput {
  cultivations: Cultivation[]
  /** Every week of the data, in order. */
  weeks: string[]
  /** The selected week. */
  week: string
  /** The weekly value in use for a cultivation, KPI and week (as the scores have it). */
  point: (cultivation: string, kpi: string, week: string) => { actual: number | null; target: number | null; paired: boolean } | undefined
  fruitTypes: FruitType[]
  rates: Rates[]
  catalog: Catalog
  forecasts: ReadonlyMap<string, CultivationForecast>
}

/** The weeks from the start of the data to `week`, inclusive. */
export const weeksToDate = (weeks: string[], week: string): string[] => weeks.filter((w) => w <= week)

export function cultivationFinancials(input: FinancialsInput, c: Cultivation, examples: boolean): CultivationFinancials {
  const facility = input.catalog.facilities.find((f) => f.name === c.facility)
  const facilityRates = facility ? input.rates.find((r) => r.facilityId === facility.id) : undefined
  const greenhouse = greenhouseOf(c, input.catalog)
  const price = priceOf(c, facilityRates, input.fruitTypes, examples)
  const rates = ratesOf(facilityRates)
  const led = greenhouse?.ledWattsPerM2 != null ? { wattsPerM2: greenhouse.ledWattsPerM2, placeholder: false } : { wattsPerM2: PLACEHOLDER_LED_W_PER_M2, placeholder: true }
  const inputs = { areaM2: c.areaM2, ledWattsPerM2: led.wattsPerM2, price: price.value, heatPerKwh: rates.heat.value, electricityPerKwh: rates.electricity.value, waterPerM3: rates.water.value }
  const valueOf: ValueOf = (kpi, week) => input.point(c.id, kpi, week)
  const linesOf = (weeks: string[]): WeekLines[] => weeks.map((w) => weekLines(inputs, valueOf, w))
  const forecast = input.forecasts.get(c.id)
  return {
    cultivation: c,
    facilityId: facility?.id ?? c.facility,
    currency: facility?.currency ?? 'USD',
    price,
    rates,
    led,
    week: periodFrom(linesOf([input.week])),
    toDate: periodFrom(linesOf(weeksToDate(input.weeks, input.week))),
    forecast: forecast ? forecastMoney(forecast, c.areaM2, price.value) : null,
  }
}

const sumPeriods = (periods: Period[]): Period => {
  const revenue = sumLines(periods.map((p) => p.revenue))
  const components = [sumLines(periods.map((p) => p.heat)), sumLines(periods.map((p) => p.led)), sumLines(periods.map((p) => p.water))]
  const base = costsAndMargin(revenue, components)
  // The gap of a facility is the sum of its cultivations' gaps (each is like for like on its own).
  const withEffects = periods.map((p) => p.effects).filter((e): e is NonNullable<Period['effects']> => e !== null)
  const effects =
    withEffects.length === 0
      ? null
      : { volume: withEffects.reduce((s, e) => s + e.volume, 0), cost: withEffects.reduce((s, e) => s + (e.cost ?? 0), 0), gap: withEffects.reduce((s, e) => s + e.gap, 0) }
  return {
    weeks: Math.max(0, ...periods.map((p) => p.weeks)),
    revenue,
    wasteValue: sumLines(periods.map((p) => p.wasteValue)),
    heat: components[0]!,
    led: components[1]!,
    water: components[2]!,
    ...base,
    effects,
  }
}

function facilityRow(label: string, cardId: string | null, currency: string, rows: CultivationFinancials[]): FacilityFinancials {
  const withForecast = rows.filter((r) => r.forecast !== null)
  const seasonEnds = withForecast.map((r) => r.forecast!.toSeasonEnd).filter((r): r is Range => r !== null)
  return {
    label,
    cardId,
    currency,
    cultivations: rows,
    areaM2: rows.reduce((s, r) => s + r.cultivation.areaM2, 0),
    week: sumPeriods(rows.map((r) => r.week)),
    toDate: sumPeriods(rows.map((r) => r.toDate)),
    forecast:
      withForecast.length === 0
        ? null
        : {
            revenue: addRanges(withForecast.map((r) => r.forecast!.revenue)),
            // Only when every forecast cultivation has a season end, so the figure is not a partial sum.
            toSeasonEnd: seasonEnds.length === withForecast.length ? addRanges(seasonEnds) : null,
            fromWeek: withForecast[0]!.forecast!.fromWeek,
            toWeek: withForecast[0]!.forecast!.toWeek,
          },
  }
}

export function buildFinancials(input: FinancialsInput): Financials {
  const examples = examplePricesInUse(input.fruitTypes, input.rates)
  const cultivations = input.cultivations.map((c) => cultivationFinancials(input, c, examples))
  const names = [...new Set(cultivations.map((c) => c.cultivation.facility))]
  const facilities = names.map((name) => {
    const rows = cultivations.filter((c) => c.cultivation.facility === name)
    return facilityRow(name, facilityCardId(name), rows[0]?.currency ?? 'USD', rows)
  })
  const currencies = new Set(facilities.map((f) => f.currency))
  const unique = <T,>(items: T[]) => [...new Set(items)]
  return {
    examplePrices: examples,
    exampleRatesFor: unique(cultivations.filter((c) => c.rates.heat.example || c.rates.electricity.example || c.rates.water.example).map((c) => c.cultivation.facility)),
    placeholderLed: unique(cultivations.filter((c) => c.led.placeholder).map((c) => c.cultivation.greenhouse)),
    cultivations,
    facilities,
    all: currencies.size === 1 && cultivations.length > 0 ? facilityRow(ALL_FACILITIES_LABEL, null, [...currencies][0]!, cultivations) : null,
  }
}
