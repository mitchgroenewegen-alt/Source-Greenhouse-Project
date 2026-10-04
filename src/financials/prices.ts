// Which price per kg and which energy and water rates a cultivation uses.

import type { Cultivation } from '../data/types'
import { fruitTypeIdOf } from '../setup/fruitTypes'
import type { FruitType, Rates } from '../workspace/types'
import { EXAMPLE_PRICES, EXAMPLE_RATES, FALLBACK_EXAMPLE_PRICE } from './defaults'
import type { PriceUsed, RatesUsed } from './types'

/**
 * Example prices are in use until a price is entered anywhere: on a fruit type, or as an override for a facility. After
 * that every price is the one entered, and a fruit type still without a price has no revenue (it says "no price").
 */
export function examplePricesInUse(fruitTypes: Pick<FruitType, 'pricePerKg'>[], rates: Pick<Rates, 'priceOverrides'>[]): boolean {
  const onType = fruitTypes.some((t) => t.pricePerKg !== null)
  const onFacility = rates.some((r) => r.priceOverrides !== null && Object.keys(r.priceOverrides).length > 0)
  return !onType && !onFacility
}

/** The price a cultivation's harvest is valued at: the facility's own price for the fruit type, else the fruit type's, else (only while examples are in use) an example. */
export function priceOf(
  cultivation: Pick<Cultivation, 'variety' | 'fruitType'>,
  facilityRates: Pick<Rates, 'priceOverrides'> | undefined,
  fruitTypes: Pick<FruitType, 'id' | 'name' | 'pricePerKg'>[],
  examples: boolean,
): PriceUsed {
  const typeId = fruitTypeIdOf(cultivation)
  const type = typeId === null ? undefined : fruitTypes.find((t) => t.id === typeId)
  const base = { fruitTypeId: typeId, fruitTypeName: type?.name ?? null }
  const override = typeId === null ? undefined : facilityRates?.priceOverrides?.[typeId]
  if (override !== undefined && override !== null) return { ...base, value: override, source: 'facility' }
  if (type && type.pricePerKg !== null) return { ...base, value: type.pricePerKg, source: 'fruit-type' }
  if (examples) return { ...base, value: (typeId !== null ? EXAMPLE_PRICES[typeId] : undefined) ?? FALLBACK_EXAMPLE_PRICE, source: 'example' }
  return { ...base, value: null, source: 'none' }
}

/** A facility's energy and water rates; each one that is not entered is an example. */
export function ratesOf(rates: Pick<Rates, 'heatPerKwh' | 'electricityPerKwh' | 'waterPerM3'> | undefined): RatesUsed {
  const pick = (entered: number | null | undefined, example: number) => (entered === null || entered === undefined ? { value: example, example: true } : { value: entered, example: false })
  return {
    heat: pick(rates?.heatPerKwh, EXAMPLE_RATES.heatPerKwh),
    electricity: pick(rates?.electricityPerKwh, EXAMPLE_RATES.electricityPerKwh),
    water: pick(rates?.waterPerM3, EXAMPLE_RATES.waterPerM3),
  }
}
