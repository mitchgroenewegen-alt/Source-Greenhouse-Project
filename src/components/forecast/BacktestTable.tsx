import { Link } from 'react-router-dom'
import { shortWeek } from '../../data/dates'
import type { Backtest } from '../../forecast'
import { METHOD_LABEL } from '../../forecast/text'
import { fixed, signedPercent } from '../../lib/format'

/** The forecast rerun as of an earlier week, against what was harvested: the error of each cultivation. */
export function BacktestTable({ backtest }: { backtest: Backtest }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-2xl border border-line bg-card p-2 shadow-sm">
        <table className="num w-full rounded-xl bg-tile text-xs sm:text-sm [&_tr>:first-child]:pl-2 [&_tr>:last-child]:pr-2">
          <caption className="sr-only">
            Forecast made as of {shortWeek(backtest.asOf)} against the real harvest in {shortWeek(backtest.from)} to {shortWeek(backtest.to)}, for each cultivation
          </caption>
          <thead>
            <tr className="border-b border-line-soft text-xs text-ink-2">
              <th scope="col" className="py-1.5 pr-1 text-left font-semibold">Cultivation</th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">
                Error<span className="block font-normal text-ink-3">each week, average</span>
              </th>
              <th scope="col" className="py-1.5 pl-1 text-right font-semibold">
                Forecast vs actual<span className="block font-normal text-ink-3">kg/m², all weeks</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {backtest.results.map((r) => (
              <tr key={r.cultivation} className="border-b border-line-soft align-top last:border-b-0">
                <th scope="row" className="py-2 pr-1 text-left font-semibold">
                  <Link to={`/cultivation/${r.cultivation}`} className="text-brand hover:underline">
                    {r.cultivation}
                  </Link>
                  <span className="block text-xs font-normal text-ink-3">{METHOD_LABEL[r.method]}</span>
                </th>
                <td className="px-1 py-2 text-right">
                  <span className="text-base font-semibold">{r.mape === null ? '–' : `${fixed(r.mape, 0)} %`}</span>
                  <span className="block text-xs text-ink-3">{r.weeks.length} {r.weeks.length === 1 ? 'week' : 'weeks'}</span>
                </td>
                <td className="py-2 pl-1 text-right">
                  {fixed(r.totalForecast, 1)} vs {fixed(r.totalActual, 1)}
                  <span className="block text-xs font-semibold">{r.totalError === null ? '–' : `${signedPercent(r.totalError, 0)}, ${r.totalError < 0 ? 'too low' : 'too high'}`}</span>
                  <span className="block text-xs text-ink-3">inside range {r.inRange} of {r.weeks.length}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {backtest.notPossible.length > 0 && (
        <p className="text-sm">
          {backtest.notPossible.join(', ')} {backtest.notPossible.length === 1 ? 'is' : 'are'} left out: by {shortWeek(backtest.asOf)} there was not enough recorded (a harvest, fruit set, fruit weight and fruit development time) to make a forecast.
        </p>
      )}
    </div>
  )
}
