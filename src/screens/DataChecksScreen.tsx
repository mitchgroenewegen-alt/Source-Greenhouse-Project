import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DecisionForm } from '../components/checks/DecisionForm'
import { DecisionLog } from '../components/checks/DecisionLog'
import { FlagGroupCard } from '../components/checks/FlagGroupCard'
import { MissingValueList } from '../components/checks/MissingValueList'
import { ChevronIcon, ChevronLeftIcon, FilterIcon } from '../components/ui/icons'
import { Segmented } from '../components/ui/Segmented'
import { RULE_ORDER, RULE_TITLE, type FlagGroup, type RuleId } from '../flags'
import { buildDecisions, DECISION_LABEL, decisionWords, type Decision, type DecisionKind } from '../storage'
import { useCropData } from '../state/CropDataContext'
import { needsReview } from '../state/groupStatus'

type Tab = 'review' | 'missing' | 'log'
/** What to show: items still waiting, items by the action taken (named as the outcome reads), or everything. */
type StatusFilter = 'open' | DecisionKind | 'all'
const ALL = 'all'
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Waiting for a decision' },
  { value: 'confirm', label: DECISION_LABEL.confirm },
  { value: 'correct', label: DECISION_LABEL.correct },
  { value: 'exclude', label: DECISION_LABEL.exclude },
  { value: 'all', label: 'All' },
]
/** A missing value cannot be excluded (it is already left out), so that filter is not offered on its tab. */
const MISSING_STATUS_OPTIONS = STATUS_OPTIONS.filter((o) => o.value !== 'exclude')
/** The note stored with each value when the whole Missing list is confirmed at once. */
const CONFIRM_ALL_NOTE = 'Confirmed: not recorded'

export default function DataChecksScreen() {
  const { groups, statusOf, decisions, decisionById, saveDecisions, removeDecisions, replaceDecisions, persistent, decidedBy, setDecidedBy, signedInAs, canWrite, workspaceStatus, cultivations, rawMode } = useCropData()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('review')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [rule, setRule] = useState<RuleId | typeof ALL>(ALL)
  const [form, setForm] = useState<{ groupId: string; kind: DecisionKind } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notice, setNotice] = useState<{ text: string; cellIds: string[] } | null>(null)
  const [blocked, setBlocked] = useState(false)
  const cultivation = params.get('cultivation') ?? ALL

  // Most certain problems first (unit slips, impossible values), then the ones that just need a look.
  const reviewGroups = useMemo(
    () =>
      groups
        .filter(needsReview)
        .sort((a, b) => RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule) || a.cultivation.localeCompare(b.cultivation) || a.kpi.localeCompare(b.kpi) || a.startDate.localeCompare(b.startDate)),
    [groups],
  )
  const missingGroups = useMemo(() => groups.filter((g) => !needsReview(g)), [groups])

  // The Excluded filter only exists on the review tab; coming from there to Missing falls back to showing everything.
  const filter: StatusFilter = tab === 'missing' && statusFilter === 'exclude' ? 'all' : statusFilter
  const decisionsOf = (g: FlagGroup) => g.flags.map((f) => decisionById.get(f.id)).filter((d): d is Decision => d !== undefined)
  const matches = (g: FlagGroup) => {
    if (cultivation !== ALL && g.cultivation !== cultivation) return false
    if (filter === 'all') return true
    if (filter === 'open') return statusOf(g) !== 'decided'
    return decisionsOf(g).some((d) => d.kind === filter)
  }
  const inCultivation = (g: FlagGroup) => cultivation === ALL || g.cultivation === cultivation

  const visibleReview = reviewGroups.filter((g) => matches(g) && (rule === ALL || g.rule === rule))
  const visibleMissing = missingGroups.filter(matches)
  const openCount = reviewGroups.filter((g) => inCultivation(g) && statusOf(g) !== 'decided').length
  const decidedCount = reviewGroups.filter((g) => inCultivation(g) && statusOf(g) === 'decided').length
  const openMissing = missingGroups.filter((g) => inCultivation(g) && statusOf(g) !== 'decided').length

  const ruleCounts = (r: RuleId) => reviewGroups.filter((g) => g.rule === r && matches(g)).length
  const reviewRules = RULE_ORDER.filter((r) => r !== 'missing-value')

  // What the collapsed phone row says, so the active filters are visible without opening the panel.
  const filterSummary = [
    STATUS_OPTIONS.find((o) => o.value === filter)?.label,
    cultivation !== ALL ? cultivation : null,
    tab === 'review' && rule !== ALL ? RULE_TITLE[rule] : null,
  ]
    .filter(Boolean)
    .join(' · ')

  /** Writing needs a signed-in person (when there is a shared database) and a reachable database; otherwise say so. */
  function mayWrite(): boolean {
    setBlocked(!canWrite)
    return canWrite
  }
  const decide = (group: FlagGroup, kind: DecisionKind) => mayWrite() && setForm({ groupId: group.id, kind })
  const reopen = (group: FlagGroup) => mayWrite() && removeDecisions(group.flags.map((f) => f.id))

  function confirmAll(list: FlagGroup[]) {
    if (!mayWrite()) return
    const name = decidedBy.trim()
    if (!name) return
    const next = list.filter((g) => statusOf(g) !== 'decided').flatMap((g) => buildDecisions(g.flags, { kind: 'confirm', decidedBy: name, note: CONFIRM_ALL_NOTE }))
    saveDecisions(next)
    setNotice({
      text: `${DECISION_LABEL.confirm}: ${next.length} missing ${next.length === 1 ? 'value' : 'values'}. They stay left out of the scores.`,
      cellIds: next.map((d) => d.cellId),
    })
  }

  /** The compact panel under a card or row, when one of its actions was clicked. */
  function formFor(group: FlagGroup) {
    if (form?.groupId !== group.id) return null
    return (
      <DecisionForm
        group={group}
        kind={form.kind}
        defaultName={decidedBy}
        signedInAs={signedInAs}
        onCancel={() => setForm(null)}
        onSave={(next, name) => {
          saveDecisions(next)
          setDecidedBy(name)
          setForm(null)
          setNotice({
            text: `${group.cultivation} · ${group.kpi} · ${decisionWords(next)} (${next.length} ${next.length === 1 ? 'value' : 'values'}). ${
              group.rule === 'missing-value' && next[0]!.kind === 'confirm'
                ? `${next.length === 1 ? 'It stays' : 'They stay'} left out of the scores.`
                : 'The scores have been updated.'
            } Find it under “${DECISION_LABEL[next[0]!.kind]}” or in the Decision log.`,
            cellIds: next.map((d) => d.cellId),
          })
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/data" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink hover:underline">
          <ChevronLeftIcon width={16} height={16} /> Data
        </Link>
        <h1 className="text-2xl font-semibold">Data checks</h1>
        <p>
          Inputs that look wrong, grouped so a run of the same problem is one item. Until someone decides, a flagged value is left out of the scores.
        </p>
      </div>

      {!persistent && (
        <p role="status" className="rounded-2xl border border-warn-line bg-warn-bg p-3 text-sm text-warn-ink">
          This browser is not keeping decisions between visits (private window or blocked storage). They last until you close the page. Use Export CSV in the decision log to keep them.
        </p>
      )}
      {rawMode && (
        <p role="status" className="rounded-2xl border border-warn-line bg-warn-bg p-3 text-sm text-warn-ink">
          “Show raw data” is on, so the scores currently count every value as recorded, whatever is decided here.
        </p>
      )}

      {blocked && !canWrite && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warn-line bg-warn-bg p-3 text-sm text-warn-ink">
          <span>
            {workspaceStatus === 'signed-out'
              ? 'Sign in to record decisions. Until then the data checks are read-only.'
              : "Decisions can't be saved while the shared database is out of reach."}
          </span>
          <span className="flex gap-2">
            {workspaceStatus === 'signed-out' && (
              <Link to="/sign-in" className="inline-flex min-h-9 items-center rounded-lg border border-warn-line bg-field px-3 font-semibold">
                Sign in
              </Link>
            )}
            <button type="button" onClick={() => setBlocked(false)} className="min-h-9 rounded-lg px-2 font-semibold">
              Dismiss
            </button>
          </span>
        </div>
      )}

      {notice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ok-line bg-ok-bg p-3 text-sm text-ok-ink">
          <span>{notice.text}</span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!mayWrite()) return
                removeDecisions(notice.cellIds)
                setNotice(null)
              }}
              className="min-h-9 rounded-lg border border-ok-line bg-field px-3 font-semibold"
            >
              Undo
            </button>
            <button type="button" onClick={() => setNotice(null)} className="min-h-9 rounded-lg px-2 font-semibold">
              Dismiss
            </button>
          </span>
        </div>
      )}

      <div role="tablist" aria-label="Data checks" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-card p-1">
        {(
          [
            ['review', `To review`, openCount],
            ['missing', 'Missing', openMissing],
            ['log', 'Decision log', decisions.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-xl px-1 text-sm font-semibold ${tab === id ? 'bg-brand text-white' : 'text-ink-2 hover:bg-brand-soft'}`}
          >
            {label} <span className={`text-xs ${tab === id ? 'text-white/85' : 'text-ink-3'}`}>{count}</span>
          </button>
        ))}
      </div>

      {tab !== 'log' && (
        <div className="rounded-2xl border border-line bg-card">
          {/* Phones: one compact row that opens the filters. From md up the filters are always shown. */}
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="check-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex min-h-11 w-full items-center gap-2 px-3 text-left md:hidden"
          >
            <FilterIcon width={18} height={18} className="shrink-0 text-ink-2" />
            <span className="text-sm font-semibold">Filters</span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-3">{filterSummary}</span>
            <ChevronIcon width={18} height={18} className={`shrink-0 text-ink-2 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
          <div id="check-filters" className={`${filtersOpen ? 'flex' : 'hidden'} flex-col gap-2 border-t border-line-soft p-3 md:flex md:border-t-0`}>
            <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-2">
              Cultivation
              <select
                value={cultivation}
                onChange={(e) => {
                  const next = new URLSearchParams(params)
                  if (e.target.value === ALL) next.delete('cultivation')
                  else next.set('cultivation', e.target.value)
                  setParams(next, { replace: true })
                }}
                className="min-h-11 rounded-lg border border-line-strong bg-field px-2 text-base font-semibold text-ink md:min-h-10 md:text-sm"
              >
                <option value={ALL}>All cultivations</option>
                {cultivations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </label>
            <Segmented label="Show" value={filter} onChange={setStatusFilter} options={tab === 'missing' ? MISSING_STATUS_OPTIONS : STATUS_OPTIONS} />
            {tab === 'review' && (
              <Segmented
                label="Kind"
                value={rule}
                onChange={setRule}
                options={[
                  { value: ALL, label: 'All', count: reviewGroups.filter(matches).length },
                  ...reviewRules.map((r) => ({ value: r, label: RULE_TITLE[r], count: ruleCounts(r) })).filter((o) => o.count > 0 || rule === o.value),
                ]}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'review' && (
        <>
          <p className="text-sm">
            {visibleReview.length} {visibleReview.length === 1 ? 'item' : 'items'} shown · {openCount} waiting for a decision · {decidedCount} confirmed, corrected or excluded.
          </p>
          {visibleReview.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card p-6 text-center text-ink-2">
              {filter === 'open' ? 'Nothing is waiting for a decision here.' : 'No items match these filters.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {visibleReview.map((group) => {
                const status = statusOf(group)
                return (
                  <FlagGroupCard
                    key={group.id}
                    group={group}
                    status={status}
                    decisions={decisionsOf(group)}
                    onChoose={(kind) => decide(group, kind)}
                    onReopen={() => reopen(group)}
                    form={formFor(group)}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'missing' && (
        <MissingValueList
          groups={visibleMissing}
          statusOf={statusOf}
          decisionsOf={decisionsOf}
          decidedBy={decidedBy}
          setDecidedBy={setDecidedBy}
          signedIn={signedInAs !== null}
          onConfirmAll={confirmAll}
          onChoose={decide}
          onReopen={reopen}
          formFor={formFor}
        />
      )}

      {tab === 'log' && <DecisionLog decisions={decisions} onReopen={(ids) => mayWrite() && removeDecisions(ids)} onReplace={(next) => mayWrite() && replaceDecisions(next)} />}
    </div>
  )
}
