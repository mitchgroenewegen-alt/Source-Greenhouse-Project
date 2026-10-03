import type { ReactNode } from 'react'
import { formatDate, formatRange } from '../../data/dates'
import type { FlagGroup } from '../../flags'
import { ACTION_LABEL, decisionOutcome, type Decision, type DecisionKind } from '../../storage'
import type { GroupStatus } from '../../state/groupStatus'

/**
 * Values that were never recorded. They are already left out of the scores, so there is nothing to exclude: the two
 * actions are Confirm values (accept that nothing was recorded) and Apply correction (enter the missing value).
 */
export function MissingValueList({
  groups,
  statusOf,
  decisionsOf,
  decidedBy,
  setDecidedBy,
  onConfirmAll,
  onChoose,
  onReopen,
  formFor,
}: {
  groups: FlagGroup[]
  statusOf: (group: FlagGroup) => GroupStatus
  decisionsOf: (group: FlagGroup) => Decision[]
  decidedBy: string
  setDecidedBy: (name: string) => void
  onConfirmAll: (groups: FlagGroup[]) => void
  onChoose: (group: FlagGroup, kind: DecisionKind) => void
  onReopen: (group: FlagGroup) => void
  /** The open decision form for this group, if any. */
  formFor: (group: FlagGroup) => ReactNode
}) {
  const open = groups.filter((g) => statusOf(g) !== 'decided')
  return (
    <section className="flex flex-col gap-3" aria-label="Missing values">
      <p className="text-sm text-ink-2">A missing value is already left out of the scores, never counted as zero.</p>
      <div className="flex items-end gap-2 rounded-xl border border-line bg-card p-3 md:gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium md:max-w-xs">
          Your name
          <input value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-card px-2 text-base font-normal md:min-h-10 md:text-sm" />
        </label>
        <button
          type="button"
          disabled={open.length === 0 || !decidedBy.trim()}
          onClick={() => onConfirmAll(open)}
          className="min-h-11 shrink-0 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50 md:min-h-10"
        >
          {ACTION_LABEL.confirm} for all {open.length}
          <span className="hidden sm:inline"> shown</span>
        </button>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-ink-2">No missing values match these filters.</p>
      ) : (
        <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-card shadow-sm">
          {groups.map((g) => {
            const decided = statusOf(g) === 'decided'
            const form = formFor(g)
            const decisions = decisionsOf(g)
            return (
              <li key={g.id} className="flex flex-col gap-2 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">
                      {g.cultivation} · {g.kpi}
                    </p>
                    <p className="text-ink-2">
                      {g.startDate === g.endDate ? formatDate(g.startDate) : formatRange(g.startDate, g.endDate)}
                      {g.flags.length > 1 ? ` · ${g.flags.length} values` : ''}
                    </p>
                    {decided && decisions.length > 0 && <p className="font-semibold text-ok-ink">{decisionOutcome(decisions)}</p>}
                  </div>
                  {decided ? (
                    <button type="button" onClick={() => onReopen(g)} className="min-h-9 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink-2">
                      Reopen
                    </button>
                  ) : (
                    !form && (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onChoose(g, 'confirm')} className="min-h-9 rounded-lg border border-ok-line bg-ok-bg px-3 text-sm font-semibold text-ok-ink">
                          {ACTION_LABEL.confirm}
                        </button>
                        <button type="button" onClick={() => onChoose(g, 'correct')} className="min-h-9 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink">
                          {ACTION_LABEL.correct}
                        </button>
                      </div>
                    )
                  )}
                </div>
                {!decided && form}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
