import { planWord, planWordForAll, type KpiConfig } from '../../config/kpis'
import { shortWeek } from '../../data/dates'
import type { WeekInfo } from '../../data/types'
import { formatValue } from '../../lib/kpiFormat'
import type { EditedWeek } from '../../editing/original'
import type { WeeklyPoint } from '../../scoring/effective'
import { scoreWith, STATUS_LABEL, type Status } from '../../scoring/score'
import { AlertIcon, CheckIcon, CrossIcon } from '../ui/icons'

// The green tint is used in full: ok-bg is close to the tile, and any less of it melts into the tile.
const CELL: Record<Status, string> = { green: 'bg-ok-bg', amber: 'bg-warn-bg/70', red: 'bg-bad-bg/70' }
const GLYPH = { green: CheckIcon, amber: AlertIcon, red: CrossIcon }
const GLYPH_COLOR: Record<Status, string> = { green: 'text-ok', amber: 'text-warn', red: 'text-bad' }

/** Every KPI of the category by week: actual on top, budget or target below, a status mark in the corner. Scrolls inside its own box. */
export function WeeklyTable({
  kpis,
  weeks,
  selectedWeek,
  pointsOf,
  editedOf,
}: {
  kpis: KpiConfig[]
  weeks: WeekInfo[]
  selectedWeek: string
  pointsOf: (kpi: string) => (WeeklyPoint | undefined)[]
  /** Which weeks of a KPI had their budget or target edited (an entry per week, in the order of `weeks`). */
  editedOf: (kpi: string) => (EditedWeek | undefined)[]
}) {
  return (
    <section aria-labelledby="weekly-table-title" className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h3 id="weekly-table-title" className="text-base font-semibold">
        Week by week
      </h3>
      <p className="mb-3 text-xs text-ink-3">Actual on top, {planWordForAll(kpis)} below. The first column stays in view when you scroll sideways.</p>
      {/* The table is a tile inside the card, one step paler; the first column is pinned with the tile's colour. */}
      <div className="overflow-x-auto rounded-xl border border-line-soft bg-tile" tabIndex={0} role="region" aria-label="Weekly table, scrolls sideways">
        <table className="num w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-36 bg-tile px-3 py-2 text-left text-xs font-semibold text-ink-2 shadow-[1px_0_0_var(--color-line-soft)]">
                KPI
              </th>
              {weeks.map((w) => (
                <th
                  key={w.id}
                  scope="col"
                  className={`min-w-16 px-2 py-2 text-right text-xs font-semibold ${w.id === selectedWeek ? 'bg-brand-soft text-brand' : 'text-ink-2'}`}
                >
                  {shortWeek(w.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kpis.map((config) => {
              const points = pointsOf(config.name)
              const edits = editedOf(config.name)
              return (
                <tr key={config.name} className="border-t border-line-soft">
                  <th scope="row" className="sticky left-0 z-10 bg-tile px-3 py-1.5 text-left align-top text-xs font-semibold shadow-[1px_0_0_var(--color-line-soft)]">
                    {config.name}
                    <span className="block font-normal text-ink-3">{config.unit}</span>
                  </th>
                  {weeks.map((w, i) => {
                    const p = points[i]
                    const score = scoreWith(config, p?.paired ? p.actual : null, p?.paired ? p.target : null)
                    const Glyph = score.status ? GLYPH[score.status] : null
                    const flagged = p && p.openFlags + p.decidedFlags > 0
                    const edited = edits[i] !== undefined
                    return (
                      <td
                        key={w.id}
                        className={`relative px-2 py-1.5 text-right align-top ${score.status ? CELL[score.status] : ''} ${w.id === selectedWeek ? 'outline outline-2 -outline-offset-2 outline-brand/40' : ''}`}
                      >
                        <span className="sr-only">
                          {shortWeek(w.id)}: {score.status ? STATUS_LABEL[score.status] : 'not scored'}.{flagged ? ' Holds a flagged value.' : ''}{edited ? ` The ${planWord(config)} was edited.` : ''}
                        </span>
                        <div className="font-semibold">{formatValue(config, p?.actual ?? null)}</div>
                        <div className="text-xs text-ink-3">{formatValue(config, p?.target ?? null)}</div>
                        {edited && <div className="text-[0.65rem] font-semibold leading-none text-ink-2">edited</div>}
                        <span className="absolute left-0.5 top-0.5 flex items-center gap-0.5" aria-hidden="true">
                          {Glyph && <Glyph width={10} height={10} className={GLYPH_COLOR[score.status!]} />}
                          {flagged && <span className="text-[0.6rem] font-bold leading-none text-flag">▲</span>}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
