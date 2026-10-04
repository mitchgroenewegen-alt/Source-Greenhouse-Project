import { shortWeek } from '../../data/dates'
import type { FacilityForecast } from '../../forecast'
import { fixed } from '../../lib/format'

const kg = (value: number) => fixed(value, 0)

/** A facility's expected harvest over the forecast weeks, in kg (kg/m² × growing area), per cultivation and in total. */
export function FacilityForecastTable({ facility, forecast, fromWeek, toWeek }: { facility: string; forecast: FacilityForecast; fromWeek: string; toWeek: string }) {
  if (forecast.rows.length === 0) return null
  return (
    <div className="rounded-xl border border-line-soft bg-tile p-2">
      <h3 className="px-0.5 text-sm font-semibold">
        Forecast, {shortWeek(fromWeek)} to {shortWeek(toWeek)}
      </h3>
      <table className="num mt-1 w-full text-xs sm:text-sm">
        <caption className="sr-only">{facility}: expected harvest over the next six weeks in kg, with its range</caption>
        <thead>
          <tr className="border-b border-line-soft text-xs text-ink-2">
            <th scope="col" className="py-1 pr-1 text-left font-semibold">Cultivation</th>
            <th scope="col" className="px-0.5 py-1 text-right font-semibold">Expected<span className="block font-normal text-ink-3">kg</span></th>
            <th scope="col" className="py-1 pl-1 text-right font-semibold">Range<span className="block font-normal text-ink-3">kg</span></th>
          </tr>
        </thead>
        <tbody>
          {forecast.rows.map((r) => (
            <tr key={r.cultivation.id} className="border-b border-line-soft align-top">
              <th scope="row" className="py-1.5 pr-1 text-left font-semibold">
                {r.cultivation.id}
                {r.method === 'uncorrected' && <span className="block text-xs font-normal text-ink-3">Uncorrected estimate</span>}
              </th>
              <td className="px-0.5 py-1.5 text-right font-semibold">{kg(r.kg.expected)}</td>
              <td className="py-1.5 pl-1 text-right text-ink-2">{kg(r.kg.low)} to {kg(r.kg.high)}</td>
            </tr>
          ))}
          <tr className="align-top font-semibold">
            <th scope="row" className="py-1.5 pr-1 text-left">Facility total</th>
            <td className="px-0.5 py-1.5 text-right">{kg(forecast.total.expected)}</td>
            <td className="py-1.5 pl-1 text-right font-normal text-ink-2">{kg(forecast.total.low)} to {kg(forecast.total.high)}</td>
          </tr>
        </tbody>
      </table>
      {forecast.without.length > 0 && <p className="mt-1 text-xs text-ink-3">No forecast for {forecast.without.join(', ')}: no harvest recorded yet.</p>}
    </div>
  )
}
