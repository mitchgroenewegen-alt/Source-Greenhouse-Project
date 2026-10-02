import { fixed, signedPercent } from '../../lib/format'
import { ChevronIcon } from '../ui/icons'
import { StatusBadge } from '../ui/StatusBadge'
import type { FacilitySummaryRow, PeriodSummary } from './facilitySummary'

const show = (value: number | null, decimals: number) => (value === null ? '–' : fixed(value, decimals))

/** Scroll to a facility's card and move keyboard focus there, so a screen reader starts reading at the breakdown. */
function jumpToCard(id: string) {
  const card = document.getElementById(id)
  if (!card) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  card.focus({ preventScroll: true })
}

/**
 * One harvest figure against its budget. On a phone the actual, the budget, the variance and the badge stack inside
 * the cell; from md up they sit on two lines, and the week's cell adds the same figures in tonnes.
 */
function HarvestCell({ summary, withTonnes = false }: { summary: PeriodSummary; withTonnes?: boolean }) {
  return (
    <td className="num px-1.5 py-2.5 align-top sm:px-3">
      <div>
        <span className="text-base font-semibold">
          <span className="sr-only">Actual </span>
          {show(summary.actual, 2)}
        </span>
        <span className="block text-xs text-ink-3 md:ml-1.5 md:inline">
          vs<span className="sr-only"> budget</span> {show(summary.budget, 2)}
          <span className="hidden md:inline"> kg/m²</span>
        </span>
      </div>
      <div className="mt-1 flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-2">
        <span className="text-sm font-semibold">
          <span className="sr-only">Variance </span>
          {summary.variance === null ? '–' : signedPercent(summary.variance)}
        </span>
        <StatusBadge status={summary.status} compact />
      </div>
      {withTonnes && (
        <div className="mt-1 hidden text-xs text-ink-3 md:block">
          {show(summary.actualTonnes, 1)} vs {show(summary.budgetTonnes, 1)} t
        </div>
      )}
    </td>
  )
}

/** The quick status of every facility and of all of them together, before each facility's full breakdown. */
export function FacilitySummaryTable({ rows, weekLabel }: { rows: FacilitySummaryRow[]; weekLabel: string }) {
  return (
    <section aria-labelledby="facility-summary-title" className="rounded-2xl border border-line bg-card shadow-sm">
      <div className="px-3 pt-3 sm:px-4">
        <h2 id="facility-summary-title" className="text-base font-semibold">
          Status at a glance
        </h2>
        <p className="text-xs text-ink-3">
          Harvest in kg/m² against budget, for {weekLabel} and since planting. Tap a facility to jump to its breakdown.
        </p>
      </div>
      {/* Safety net: if a very large number ever makes the table wider than the card, it scrolls here, not the page. */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Harvest against budget in kg/m² for each facility and for all facilities together</caption>
          <thead>
            <tr className="border-y border-line text-xs text-ink-2">
              <th scope="col" className="px-1.5 py-1.5 text-left font-semibold min-[360px]:px-2 sm:px-4">
                Facility
              </th>
              <th scope="col" className="px-1.5 py-1.5 text-left font-semibold sm:px-3">
                {weekLabel} harvest
                <span className="block font-normal text-ink-3">actual vs budget</span>
              </th>
              <th scope="col" className="px-1.5 py-1.5 text-left font-semibold sm:px-3">
                Harvest since planting
                <span className="block font-normal text-ink-3">actual vs budget</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const jump = row.cardId
              return (
                <tr
                  key={row.label}
                  // The whole row is the tap target for a mouse or finger; the button in the first cell is the keyboard's way in,
                  // and its click bubbles up to here.
                  onClick={jump ? () => jumpToCard(jump) : undefined}
                  className={`border-b border-line-soft last:border-b-0 ${jump ? 'cursor-pointer hover:bg-brand-soft/50 active:bg-brand-soft' : 'bg-page/70'}`}
                >
                  <th scope="row" className="px-1.5 py-2.5 text-left align-top font-semibold min-[360px]:px-2 sm:px-4">
                    {jump ? (
                      <button type="button" className="flex items-center gap-0.5 rounded text-left font-semibold text-brand">
                        {row.label}
                        {/* The arrow is dropped on the narrowest phones (320 px) to keep the table inside the card. */}
                        <ChevronIcon width={14} height={14} className="hidden shrink-0 min-[360px]:block" />
                        <span className="sr-only">, jump to its breakdown</span>
                      </button>
                    ) : (
                      row.label
                    )}
                    <span className="num mt-0.5 block text-xs font-normal text-ink-3">
                      <span className="block md:inline">
                        {row.cultivationCount} {row.cultivationCount === 1 ? 'cultivation' : 'cultivations'}
                      </span>
                      <span className="hidden md:inline"> · </span>
                      <span className="block md:inline">{fixed(row.areaM2, 0)}&nbsp;m²</span>
                    </span>
                  </th>
                  <HarvestCell summary={row.week} withTonnes />
                  <HarvestCell summary={row.cumulative} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
