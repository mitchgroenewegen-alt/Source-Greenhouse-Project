import type { Cultivation } from '../data/types'
import type { Range } from '../forecast'

/** An actual and its budget, in money. A null is "not available", never zero. */
export interface Line {
  actual: number | null
  budget: number | null
}

export type PriceSource = 'facility' | 'fruit-type' | 'example' | 'none'

export interface PriceUsed {
  /** Money per kg; null when there is no price at all. */
  value: number | null
  source: PriceSource
  fruitTypeId: string | null
  fruitTypeName: string | null
}

export interface RateUsed {
  value: number
  /** True when no rate was entered and the example one is used. */
  example: boolean
}

export interface RatesUsed {
  heat: RateUsed
  electricity: RateUsed
  water: RateUsed
}

export interface LedPower {
  wattsPerM2: number
  /** True when the greenhouse has no installed power entered and the placeholder is used. */
  placeholder: boolean
}

/** What splits the like-for-like gap in the margin: more or fewer kg (volume) and more or less energy (cost). They add up to `gap`. */
export interface Effects {
  /** Revenue actual minus revenue budget: the price is the same on both sides, so this is all kg. */
  volume: number
  /** Budgeted energy cost minus actual energy cost, over the costs that have a budget. Null when no cost has a budget. */
  cost: number | null
  gap: number
}

export interface Costs extends Line {
  /** The actual cost of just the components that have a budget (what the gap compares). */
  actualCompared: number | null
  /** Cost with no budget to compare with (irrigation water until a target is entered). */
  uncompared: number
}

/** One cultivation's money for a week, or added up over several weeks. */
export interface Period {
  /** Weeks that went into the figures (those with any value). */
  weeks: number
  revenue: Line
  wasteValue: Line
  heat: Line
  led: Line
  water: Line
  /** Heat + LED + water. */
  costs: Costs
  /** Revenue minus costs: a partial margin (labour, plants and packaging are not in the data). */
  margin: Line
  effects: Effects | null
}

export interface CultivationForecastMoney {
  fromWeek: string
  toWeek: string
  /** Revenue of the forecast weeks. */
  revenue: Range
  /** Revenue of the weeks after them up to the season end, when the forecast has a season end; else null. */
  toSeasonEnd: Range | null
}

export interface CultivationFinancials {
  cultivation: Cultivation
  facilityId: string
  currency: string
  price: PriceUsed
  rates: RatesUsed
  led: LedPower
  week: Period
  toDate: Period
  forecast: CultivationForecastMoney | null
}

export interface FacilityFinancials {
  /** A facility name, or "All facilities". */
  label: string
  cardId: string | null
  currency: string
  cultivations: CultivationFinancials[]
  areaM2: number
  week: Period
  toDate: Period
  forecast: { revenue: Range; toSeasonEnd: Range | null; fromWeek: string; toWeek: string } | null
}

export interface Financials {
  /** True while no price has been entered anywhere, so every price is an example. */
  examplePrices: boolean
  /** Facilities (by name) where at least one energy or water rate is an example. */
  exampleRatesFor: string[]
  /** Greenhouses (by name) using the placeholder LED power. */
  placeholderLed: string[]
  cultivations: CultivationFinancials[]
  facilities: FacilityFinancials[]
  /** The row for all facilities together; null when their currencies differ. */
  all: FacilityFinancials | null
}
