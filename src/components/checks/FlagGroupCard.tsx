import { useState } from 'react'
import { Link } from 'react-router-dom'
import { kpiConfig, planWord } from '../../config/kpis'
import { formatDate, formatRange } from '../../data/dates'
import { fieldWord, ruleTitleFor, type FlagGroup } from '../../flags'
import { formatDateTime, plain } from '../../lib/format'
import { ACTION_LABEL, decisionOutcome, type Decision, type DecisionKind } from '../../storage'
import type { GroupStatus } from '../../state/groupStatus'
import { FlagIcon } from '../ui/icons'
import { FlagSourceToggle, SourceCells } from './SourceCells'

const SEVERITY_STYLE = {
  error: 'bg-bad-bg text-bad-ink border-bad-line',
  warning: 'bg-warn-bg text-warn-ink border-warn-line',
  info: 'bg-none-bg text-none-ink border-none-line',
}
const SEVERITY_WORD = { error: 'Likely error', warning: 'Check', info: 'For information' }

/** One grouped flag: what is wrong, the values, and the three actions: Confirm values, Apply correction, Exclude. */
export function FlagGroupCard({
  group,
  status,
  decisions,
  onChoose,
  onReopen,
  form,
}: {
  group: FlagGroup
  status: GroupStatus
  decisions: Decision[]
  onChoose: (kind: DecisionKind) => void
  onReopen: () => void
  /** The open decision form for this group, if any. */
  form: React.ReactNode
}) {
  const [showAll, setShowAll] = useState(false)
  // Where each value sits in the workbook: open for the first value of the group, the others on demand.
  const [openCells, setOpenCells] = useState<Set<string>>(() => new Set(group.flags.slice(0, 1).map((f) => f.id)))
  const toggleCell = (id: string) => setOpenCells((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next })
  const config = kpiConfig(group.kpi)
  const missing = group.rule === 'missing-value'
  // The workbook column is always "Target"; a budget KPI says so, a target KPI just names the column.
  const columnLabel = group.field === 'actual' ? 'Actual column' : planWord(config) === 'budget' ? 'Budget (target column)' : 'Target column'
  const samples = showAll ? group.flags : group.flags.slice(0, 3)
  const range =
    group.startDate === group.endDate ? formatDate(group.startDate) : formatRange(group.startDate, group.endDate)

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm" aria-label={`${group.cultivation}, ${group.kpi}, ${fieldWord(group.field, group.kpi)}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">
            <Link to={`/cultivation/${group.cultivation}`} className="text-brand hover:underline">
              {group.cultivation}
            </Link>{' '}
            · {group.kpi}
          </h3>
          <p className="text-sm text-ink-2">
            {columnLabel} · {range}
            {group.flags.length > 1 ? ` · ${group.flags.length} values` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[group.severity]}`}>
            <FlagIcon width={12} height={12} />
            {SEVERITY_WORD[group.severity]}
          </span>
          <span className="whitespace-nowrap rounded-full bg-flag-bg px-2 py-0.5 text-xs font-semibold text-flag-ink">{ruleTitleFor(group.rule, group.kpi)}</span>
        </div>
      </header>

      <p className="text-sm">{group.explanation}</p>

      {!missing && (
        <div className="overflow-x-auto rounded-xl border border-line-soft bg-tile px-2 py-2 sm:px-3">
          <table className="num w-full text-xs sm:text-sm">
            <caption className="sr-only">Recorded values in this item</caption>
            <thead>
              <tr className="text-xs text-ink-2">
                <th scope="col" className="py-1 pr-2 text-left font-semibold sm:pr-3">Date</th>
                <th scope="col" className="py-1 pr-2 text-right font-semibold sm:pr-3">Recorded</th>
                {group.suggestionNote && <th scope="col" className="py-1 pr-2 text-right font-semibold sm:pr-3">Suggested</th>}
                <th scope="col" className="py-1 text-right font-semibold">Workbook</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((f) => (
                                  <tr className="border-t border-line-soft">
                    <td className="py-1 pr-2 sm:pr-3">{formatDate(f.date)}</td>
                    <td className="py-1 pr-2 text-right sm:pr-3">{f.value === null ? '–' : `${plain(f.value)} ${config.unit}`}</td>
                    {group.suggestionNote && <td className="py-1 pr-2 text-right font-semibold sm:pr-3">{f.suggestion === null ? '–' : `${plain(f.suggestion)} ${config.unit}`}</td>}
                    <td className="py-1 text-right">
                      <FlagSourceToggle flag={f} open={openCells.has(f.id)} onToggle={() => toggleCell(f.id)} />
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
          {samples.filter((f) => openCells.has(f.id)).map((f) => (
            <div key={f.id} id={`cells-${f.id}`} className="mt-2 flex flex-col gap-1">
              {group.flags.length > 1 && <h4 className="text-xs font-semibold text-ink-2">Value of {formatDate(f.date)}</h4>}
              <SourceCells flag={f} />
            </div>
          ))}
          {group.flags.length > 3 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1 min-h-9 text-sm font-semibold text-brand hover:underline">
              {showAll ? 'Show fewer' : `Show all ${group.flags.length} values`}
            </button>
          )}
        </div>
      )}

      {status === 'decided' ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ok-line bg-ok-bg px-3 py-2 text-sm text-ok-ink">
          <div>
            <p className="font-semibold">{decisionOutcome(decisions)}</p>
            <p className="text-xs">
              {formatDateTime(decisions[0]!.decidedAt)}
              {decisions[0]!.note ? ` · “${decisions[0]!.note}”` : ''}
            </p>
          </div>
          <button type="button" onClick={onReopen} className="min-h-9 rounded-lg border border-ok-line bg-field px-3 text-sm font-semibold text-ok-ink">
            Reopen
          </button>
        </div>
      ) : (
        <>
          {!missing && (
            <p className="text-sm text-ink-2">
              {status === 'partial' ? 'Some values here were decided; the rest are still left out of the scores.' : 'Until someone decides, these values are left out of the scores.'}
            </p>
          )}
          {!form && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onChoose('confirm')} className="min-h-10 rounded-lg border border-ok-line bg-ok-bg px-3 text-sm font-semibold text-ok-ink">
                {ACTION_LABEL.confirm}
              </button>
              <button type="button" onClick={() => onChoose('correct')} className="min-h-10 rounded-lg border border-line-strong bg-field px-3 text-sm font-semibold text-ink">
                {ACTION_LABEL.correct}
              </button>
              <button type="button" onClick={() => onChoose('exclude')} className="min-h-10 rounded-lg border border-line-strong bg-field px-3 text-sm font-semibold text-ink">
                {ACTION_LABEL.exclude}
              </button>
            </div>
          )}
          {form}
        </>
      )}
    </article>
  )
}
