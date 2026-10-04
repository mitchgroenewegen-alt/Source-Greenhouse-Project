import { Link } from 'react-router-dom'
import type { Cultivation } from '../../data/types'
import type { CultivationForecast } from '../../forecast'
import { METHOD_LABEL, rangeText } from '../../forecast/text'
import { fixed } from '../../lib/format'

/** The six-week forecast of each cultivation: expected harvest and its range, and whether the estimate was corrected. */
export function ForecastTable({ rows }: { rows: { cultivation: Cultivation; forecast: CultivationForecast | undefined }[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card p-2 shadow-sm">
      <table className="num w-full rounded-xl bg-tile text-xs sm:text-sm [&_tr>:first-child]:pl-2 [&_tr>:last-child]:pr-2">
        <caption className="sr-only">Expected harvest for the next six weeks, in kg/m², with its range and how it was made</caption>
        <thead>
          <tr className="border-b border-line-soft text-xs text-ink-2">
            <th scope="col" className="py-1.5 pr-1 text-left font-semibold">Cultivation</th>
            <th scope="col" className="px-1 py-1.5 text-right font-semibold">
              Expected<span className="block font-normal text-ink-3">kg/m²</span>
            </th>
            <th scope="col" className="py-1.5 pl-1 text-right font-semibold">
              Range<span className="block font-normal text-ink-3">kg/m²</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cultivation, forecast }) => (
            <tr key={cultivation.id} className="border-b border-line-soft align-top last:border-b-0">
              <th scope="row" className="py-2 pr-1 text-left font-semibold">
                <Link to={`/cultivation/${cultivation.id}`} className="text-brand hover:underline">
                  {cultivation.id}
                </Link>
                <span className="block text-xs font-normal text-ink-3">
                  {forecast ? `${METHOD_LABEL[forecast.correction.method]}${forecast.correction.method === 'corrected' ? ` ×${fixed(forecast.correction.factor, 2)}` : ''}` : 'No harvest recorded'}
                </span>
              </th>
              <td className="px-1 py-2 text-right font-semibold">{forecast && forecast.weeks.length > 0 ? fixed(forecast.total.expected, 1) : '–'}</td>
              <td className="py-2 pl-1 text-right text-ink-2">{forecast && forecast.weeks.length > 0 ? rangeText(forecast.total, '', 1).trim() : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
