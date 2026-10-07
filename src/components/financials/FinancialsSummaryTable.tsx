import { fixed } from '../../lib/format'
import type { FacilityFinancials } from '../../financials'
import { ChevronIcon } from '../ui/icons'
import { MoneyCell } from './MoneyCell'

const GAP_BELOW_HEADER = 16

/** Scroll to a facility's card and move keyboard focus there (the same way as the summary on Facilities). */
function jumpToCard(id: string) {
  const card = document.getElementById(id)
  if (!card) return
  const header = document.getElementById('app-header')
  const sticky = header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0
  const top = card.getBoundingClientRect().top + window.scrollY - sticky - GAP_BELOW_HEADER
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' })
  card.focus({ preventScroll: true })
}

/** Revenue, energy and water cost and partial margin of every facility and of all of them, each against budget, for the chosen period. */
export function FinancialsSummaryTable({ rows, period, periodLabel, currency }: { rows: FacilityFinancials[]; period: 'week' | 'toDate'; periodLabel: string; currency: string | null }) {
  return (
    <section aria-labelledby="financials-summary-title" className="rounded-2xl border border-line bg-card p-3 shadow-sm sm:p-4">
      <h2 id="financials-summary-title" className="text-base font-semibold">
        Money at a glance
      </h2>
      <p className="text-xs text-ink-3">
        {periodLabel}, in thousands{currency ? ` of ${currency}` : ''}, against budget. Margin is after energy and water only. Percentages leave out cost that has no budget (irrigation water, LED without a budget). Tap a facility to jump to its cultivations.
      </p>
      <div className="-mx-3 mt-3 overflow-x-auto border-y border-line-soft bg-tile sm:mx-0 sm:rounded-xl sm:border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Revenue, energy and water cost and partial margin against budget for each facility and for all facilities together</caption>
          <thead>
            <tr className="border-b border-line-soft text-xs text-ink-2">
              <th scope="col" className="px-1.5 py-1.5 text-left font-semibold sm:px-4">Facility</th>
              <th scope="col" className="px-1 py-1.5 text-left font-semibold sm:px-3">Revenue</th>
              <th scope="col" className="px-1 py-1.5 text-left font-semibold sm:px-3">Energy and water</th>
              <th scope="col" className="px-1 py-1.5 text-left font-semibold sm:px-3">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const p = row[period]
              return (
                <tr
                  key={row.label}
                  onClick={row.cardId ? () => jumpToCard(row.cardId!) : undefined}
                  className={`border-b border-line-soft last:border-b-0 ${row.cardId ? 'cursor-pointer hover:bg-brand-soft active:bg-tile' : 'bg-card'}`}
                >
                  <th scope="row" className="px-1.5 py-2.5 text-left align-top font-semibold sm:px-4">
                    {row.cardId ? (
                      <button type="button" className="flex items-center gap-0.5 rounded text-left font-semibold text-brand">
                        {row.label}
                        <ChevronIcon width={14} height={14} className="hidden shrink-0 min-[400px]:block" />
                        <span className="sr-only">, jump to its cultivations</span>
                      </button>
                    ) : (
                      row.label
                    )}
                    <span className="num mt-0.5 block text-xs font-normal text-ink-3">{fixed(row.areaM2, 0)}&nbsp;m²</span>
                  </th>
                  <MoneyCell kind="revenue" line={p.revenue} />
                  <MoneyCell kind="cost" line={{ actual: p.costs.actual, budget: p.costs.budget }} compared={p.costs.actualCompared} />
                  <MoneyCell kind="margin" line={p.margin} compared={p.revenue.actual === null || p.costs.actualCompared === null ? null : p.revenue.actual - p.costs.actualCompared} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
