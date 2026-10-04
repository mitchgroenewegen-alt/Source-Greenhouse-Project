import { Link } from 'react-router-dom'
import { EXAMPLE_PRICES, PLACEHOLDER_LED_W_PER_M2 } from '../../financials'

/**
 * Shown on Financials for as long as the prices are the examples, which is until a price is entered. The two notes under it are not
 * the banner: they say which energy and water rates are examples and which greenhouses use the placeholder LED power.
 */
export function ExamplePricesBanner({ examplePrices, exampleRatesFor, placeholderLed }: { examplePrices: boolean; exampleRatesFor: string[]; placeholderLed: string[] }) {
  return (
    <>
      {examplePrices && (
        <div role="status" data-testid="example-prices-banner" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warn-line bg-warn-bg p-3 text-sm text-warn-ink">
          <span>
            <strong>Example prices.</strong> The workbook has no prices, so revenue uses made-up prices per kg (for example TOV at {EXAMPLE_PRICES['tov']!.toFixed(2)} USD). Enter your own and this goes away.
          </span>
          <Link to="/prices" className="inline-flex min-h-9 items-center rounded-lg border border-warn-line bg-field px-3 font-semibold">
            Prices and costs
          </Link>
        </div>
      )}
      {(exampleRatesFor.length > 0 || placeholderLed.length > 0) && (
        <div data-testid="example-rates-note" className="rounded-2xl border border-line bg-card p-3 text-sm">
          {exampleRatesFor.length > 0 && (
            <p>
              Energy and water costs use example rates for {exampleRatesFor.join(', ')}. <Link to="/prices" className="font-semibold underline">Enter the real rates.</Link>
            </p>
          )}
          {placeholderLed.length > 0 && (
            <p>
              LED cost assumes {PLACEHOLDER_LED_W_PER_M2} W/m² (a placeholder) for {placeholderLed.join(', ')}, which have no installed LED power entered on <Link to="/setup" className="font-semibold underline">Setup</Link>.
            </p>
          )}
        </div>
      )}
    </>
  )
}
