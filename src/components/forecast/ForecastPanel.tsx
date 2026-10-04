import { Link } from 'react-router-dom'
import { shortWeek } from '../../data/dates'
import { forecastWeekIds, type CultivationForecast } from '../../forecast'
import { methodText, rangeText } from '../../forecast/text'
import { fixed } from '../../lib/format'

/** On a cultivation's Production tab: the next six weeks in one tile, how they were worked out, and the way to the backtest. */
export function ForecastPanel({ forecast, areaM2 }: { forecast: CultivationForecast | undefined; areaM2: number }) {
  if (!forecast) {
    return (
      <section aria-label="Forecast" className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <h3 className="text-base font-semibold">Forecast</h3>
        <p className="mt-1 text-sm text-ink-2">No harvest is recorded yet, so there is nothing to forecast from.</p>
      </section>
    )
  }
  const weeks = forecastWeekIds(forecast.asOf)
  return (
    <section aria-label="Forecast" className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h3 className="text-base font-semibold">
        Forecast, {shortWeek(weeks[0]!)} to {shortWeek(weeks[weeks.length - 1]!)}
      </h3>
      {forecast.weeks.length === 0 ? (
        <p className="text-sm text-ink-2">The fruit set, fruit weight or fruit development time needed for the forecast is not recorded for these weeks.</p>
      ) : (
        <p className="num rounded-xl border border-line-soft bg-tile p-3 text-sm text-ink-2">
          <span className="text-lg font-semibold text-ink">{fixed(forecast.total.expected, 1)} kg/m²</span> expected, {rangeText(forecast.total, 'kg/m²')}
          <span className="block text-xs text-ink-3">
            {fixed(forecast.total.expected * areaM2, 0)} kg on {fixed(areaM2, 0)} m². The dashed lines on the Harvest and Cumulative harvest charts show it week by week.
          </span>
        </p>
      )}
      <p className="text-sm text-ink-2">{methodText(forecast.correction)}</p>
      {forecast.missingWeeks.length > 0 && forecast.weeks.length > 0 && (
        <p className="text-xs text-ink-3">No estimate for {forecast.missingWeeks.map(shortWeek).join(', ')}: the fruit weight or development time is missing.</p>
      )}
      <Link to="/forecast#how-good" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand hover:underline">
        How good is this?
      </Link>
    </section>
  )
}
