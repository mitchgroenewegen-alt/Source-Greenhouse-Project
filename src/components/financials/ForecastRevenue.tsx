import type { CultivationForecastMoney } from '../../financials'
import { moneyText } from '../../financials'

const range = (r: { low: number; high: number }, currency: string) => `${moneyText(r.low, currency)} to ${moneyText(r.high, currency)}`

/** Expected revenue for the forecast weeks as a range, and to the season end when the forecast has one. */
export function ForecastRevenue({ forecast, price, currency, fromLabel, toLabel, hasForecast }: { forecast: CultivationForecastMoney | null; price: number | null; currency: string; fromLabel: string; toLabel: string; hasForecast: boolean }) {
  if (!hasForecast || !forecast) {
    return (
      <p className="rounded-xl border border-line-soft bg-tile p-2 text-sm text-ink-2">
        {price === null ? 'No forecast revenue without a price.' : 'No forecast revenue: no harvest is recorded yet.'}
      </p>
    )
  }
  return (
    <div className="rounded-xl border border-line-soft bg-tile p-2">
      <h4 className="px-0.5 text-sm font-semibold">
        Forecast revenue, {fromLabel} to {toLabel}
      </h4>
      <p className="num px-0.5 text-sm">
        <span className="font-semibold">{moneyText(forecast.revenue.expected, currency)}</span> expected, range {range(forecast.revenue, currency)}
      </p>
      {forecast.toSeasonEnd && (
        <p className="num px-0.5 text-sm">
          To the season end: <span className="font-semibold">{moneyText(forecast.toSeasonEnd.expected, currency)}</span> expected, range {range(forecast.toSeasonEnd, currency)}
        </p>
      )}
    </div>
  )
}
