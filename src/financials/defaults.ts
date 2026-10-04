// The stand-in numbers Financials uses until real ones are entered. The workbook holds no prices or costs, so these are
// examples to make the screen readable, not facts: the screen says so (see ExamplePricesBanner) for as long as they are used.

/** USD per kg, by fruit type id. A fruit type added in the app with no example of its own gets FALLBACK_EXAMPLE_PRICE. */
export const EXAMPLE_PRICES: Record<string, number> = {
  grape: 6,
  snack: 5,
  cherry: 5.5,
  'grape-on-the-vine': 4.5,
  cocktail: 3.5,
  plum: 3.2,
  roma: 2.2,
  tov: 2.5,
  beef: 2,
}
export const FALLBACK_EXAMPLE_PRICE = 3

/** Per facility, in its currency: heat per kWh, electricity per kWh and water per m³. */
export const EXAMPLE_RATES = { heatPerKwh: 0.05, electricityPerKwh: 0.12, waterPerM3: 1.5 }

/**
 * Installed LED power in W/m², used for a greenhouse that has none entered (the workbook gives no greenhouse details).
 * A placeholder: it is marked wherever it is used, and the real figure goes on Setup, in the greenhouse.
 */
export const PLACEHOLDER_LED_W_PER_M2 = 150

/** The KPIs the money is made from (names as in src/config/kpis.ts). Heating is kWh/m² a week, LED lighting is hours a week, irrigation water is L/m² a week. */
export const FINANCIAL_KPI = {
  harvest: 'Harvest',
  waste: 'Waste',
  heating: 'Heating energy (approx.)',
  led: 'LED lighting',
  water: 'Irrigation water',
} as const
