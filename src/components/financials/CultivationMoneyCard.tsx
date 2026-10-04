import { Link } from 'react-router-dom'
import { shortWeek } from '../../data/dates'
import { variancePercent, type CultivationFinancials, type Period } from '../../financials'
import { fixed, signedPercent } from '../../lib/format'
import { EffectsList } from './EffectsList'
import { ForecastRevenue } from './ForecastRevenue'
import { PriceNote } from './PriceNote'

interface LineSpec {
  label: string
  line: { actual: number | null; budget: number | null }
  /** What the budget cell says when there is none: "no target" for irrigation water, which has no target in the workbook. */
  noBudget: string
  strong?: boolean
  /** The actual on the same basis as the budget, when the line's own actual includes cost with no budget: the percentage uses it. */
  compared?: number | null
}

const linesOf = (p: Period): LineSpec[] => [
  { label: 'Revenue', line: p.revenue, noBudget: 'no budget', strong: true },
  { label: 'Value lost to waste', line: p.wasteValue, noBudget: 'no budget' },
  { label: 'Heating', line: p.heat, noBudget: 'no budget' },
  { label: 'LED lighting', line: p.led, noBudget: 'no budget' },
  { label: 'Irrigation water', line: p.water, noBudget: 'no target' },
  { label: 'Energy and water cost', line: { actual: p.costs.actual, budget: p.costs.budget }, noBudget: 'no budget', strong: true, compared: p.costs.actualCompared },
  { label: 'Partial margin', line: p.margin, noBudget: 'no budget', strong: true, compared: p.revenue.actual === null || p.costs.actualCompared === null ? null : p.revenue.actual - p.costs.actualCompared },
]

/** One cultivation's money for the chosen period against budget, what drove the gap, and the expected revenue. */
export function CultivationMoneyCard({ f, period, periodLabel }: { f: CultivationFinancials; period: 'week' | 'toDate'; periodLabel: string }) {
  const p = f[period]
  const c = f.currency
  const id = `money-${f.cultivation.id}`
  return (
    <article aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm sm:p-4">
      <header>
        <h3 id={id} className="text-lg font-semibold leading-tight">
          <Link to={`/cultivation/${f.cultivation.id}`} className="text-brand hover:underline">
            {f.cultivation.id}
          </Link>
        </h3>
        <p className="num text-sm text-ink-2">
          {f.cultivation.facility} · {f.cultivation.greenhouse} · {fixed(f.cultivation.areaM2, 0)} m²
        </p>
        <PriceNote f={f} />
      </header>

      <div className="overflow-x-auto rounded-xl border border-line-soft bg-tile">
        <table className="num w-full text-xs sm:text-sm [&_tr>:first-child]:pl-2 [&_tr>:last-child]:pr-2">
          <caption className="sr-only">
            {f.cultivation.id}: {periodLabel}, money in {c} against budget
          </caption>
          <thead>
            <tr className="border-b border-line-soft text-xs text-ink-2">
              <th scope="col" className="py-1.5 pr-1 text-left font-semibold">{periodLabel}</th>
              <th scope="col" className="px-0.5 py-1.5 text-right font-semibold">Actual<span className="block font-normal text-ink-3">{c}</span></th>
              <th scope="col" className="px-0.5 py-1.5 text-right font-semibold">Budget<span className="block font-normal text-ink-3">{c}</span></th>
              <th scope="col" className="py-1.5 pl-1 text-right font-semibold">vs budget</th>
            </tr>
          </thead>
          <tbody>
            {linesOf(p).map(({ label, line, noBudget, strong, compared }) => {
              const variance = variancePercent({ actual: compared === undefined ? line.actual : compared, budget: line.budget })
              return (
                <tr key={label} className={`border-b border-line-soft last:border-b-0 align-top ${strong ? 'font-semibold' : ''}`}>
                  <th scope="row" className="py-1.5 pr-1 text-left font-semibold">{label}</th>
                  <td className="px-0.5 py-1.5 text-right">{line.actual === null ? '–' : fixed(line.actual, 0)}</td>
                  <td className="px-0.5 py-1.5 text-right font-normal text-ink-2">{line.budget === null ? <span className="text-xs text-ink-3">{noBudget}</span> : fixed(line.budget, 0)}</td>
                  <td className="py-1.5 pl-1 text-right">{variance === null ? '–' : signedPercent(variance)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">
        Partial margin: revenue minus energy and water. Labour, plants and packaging are not in the data. Value lost to waste is not taken off again: harvest is already net. The percentages on the cost and margin lines leave out cost that has no budget.
      </p>

      <EffectsList effects={p.effects} uncompared={p.costs.uncompared} currency={c} />
      <ForecastRevenue forecast={f.forecast} price={f.price.value} currency={c} fromLabel={f.forecast ? shortWeek(f.forecast.fromWeek) : ''} toLabel={f.forecast ? shortWeek(f.forecast.toWeek) : ''} hasForecast={f.forecast !== null} />
      {p.revenue.actual === null && f.price.value !== null && <p className="text-sm text-ink-2">No harvest is recorded for this period, so there is no revenue to show.</p>}
    </article>
  )
}
