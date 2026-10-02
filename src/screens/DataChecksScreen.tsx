import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DecisionForm } from '../components/checks/DecisionForm'
import { DecisionLog } from '../components/checks/DecisionLog'
import { FlagGroupCard } from '../components/checks/FlagGroupCard'
import { ChevronIcon, FilterIcon } from '../components/ui/icons'
import { Segmented } from '../components/ui/Segmented'
import { formatDate, formatRange } from '../data/dates'
import { RULE_ORDER, RULE_TITLE, type FlagGroup, type RuleId } from '../flags'
import { buildDecisions, type DecisionKind } from '../storage'
import { useCropData } from '../state/CropDataContext'
import { needsReview } from '../state/groupStatus'

type Tab = 'review' | 'missing' | 'log'
type StatusFilter = 'open' | 'decided' | 'all'
const ALL = 'all'
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Waiting for a decision' },
  { value: 'decided', label: 'Decided' },
  { value: 'all', label: 'Both' },
]

export default function DataChecksScreen() {
  const { groups, statusOf, decisions, decisionById, saveDecisions, removeDecisions, replaceDecisions, persistent, decidedBy, setDecidedBy, cultivations, rawMode } = useCropData()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('review')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [rule, setRule] = useState<RuleId | typeof ALL>(ALL)
  const [form, setForm] = useState<{ groupId: string; kind: DecisionKind } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notice, setNotice] = useState<{ text: string; cellIds: string[] } | null>(null)
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

  const matches = (g: FlagGroup) => {
    if (cultivation !== ALL && g.cultivation !== cultivation) return false
    const decided = statusOf(g) === 'decided'
    return statusFilter === 'all' || (statusFilter === 'decided' ? decided : !decided)
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
    STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label,
    cultivation !== ALL ? cultivation : null,
    tab === 'review' && rule !== ALL ? RULE_TITLE[rule] : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const decide = (group: FlagGroup, kind: DecisionKind) => setForm({ groupId: group.id, kind })
  const reopen = (group: FlagGroup) => removeDecisions(group.flags.map((f) => f.id))

  function acknowledgeAll(list: FlagGroup[]) {
    const name = decidedBy.trim()
    if (!name) return
    saveDecisions(list.filter((g) => statusOf(g) !== 'decided').flatMap((g) => buildDecisions(g.flags, { kind: 'confirm', decidedBy: name, note: 'Acknowledged: not recorded' })))
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Data checks</h1>
        <p className="text-ink-2">
          Inputs that look wrong, grouped so a run of the same problem is one item. Until someone decides, a flagged value is left out of the scores.
        </p>
      </div>

      {!persistent && (
        <p role="status" className="rounded-xl border border-warn-line bg-warn-bg p-3 text-sm text-warn-ink">
          This browser is not keeping decisions between visits (private window or blocked storage). They last until you close the page. Use Export CSV in the decision log to keep them.
        </p>
      )}
      {rawMode && (
        <p role="status" className="rounded-xl border border-warn-line bg-warn-bg p-3 text-sm text-warn-ink">
          “Show raw data” is on, so the scores currently count every value as recorded, whatever is decided here.
        </p>
      )}

      {notice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ok-line bg-ok-bg p-3 text-sm text-ok-ink">
          <span>{notice.text}</span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                removeDecisions(notice.cellIds)
                setNotice(null)
              }}
              className="min-h-9 rounded-lg border border-ok-line bg-card px-3 font-semibold"
            >
              Undo
            </button>
            <button type="button" onClick={() => setNotice(null)} className="min-h-9 rounded-lg px-2 font-semibold">
              Dismiss
            </button>
          </span>
        </div>
      )}

      <div role="tablist" aria-label="Data checks" className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-card p-1">
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
            className={`min-h-11 rounded-lg px-1 text-sm font-semibold ${tab === id ? 'bg-brand text-white' : 'text-ink-2 hover:bg-line-soft'}`}
          >
            {label} <span className={`text-xs ${tab === id ? 'text-white/85' : 'text-ink-3'}`}>{count}</span>
          </button>
        ))}
      </div>

      {tab !== 'log' && (
        <div className="rounded-xl border border-line bg-card">
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
                className="min-h-11 rounded-lg border border-line bg-card px-2 text-base font-semibold text-ink md:min-h-10 md:text-sm"
              >
                <option value={ALL}>All cultivations</option>
                {cultivations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </label>
            <Segmented label="Show" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
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
          <p className="text-sm text-ink-3">
            {visibleReview.length} {visibleReview.length === 1 ? 'item' : 'items'} shown · {openCount} waiting · {decidedCount} decided.
          </p>
          {visibleReview.length === 0 ? (
            <p className="rounded-xl border border-line bg-card p-6 text-center text-ink-2">
              {statusFilter === 'open' ? 'Nothing is waiting for a decision here.' : 'No items match these filters.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {visibleReview.map((group) => {
                const status = statusOf(group)
                const own = group.flags.map((f) => decisionById.get(f.id)).filter((d): d is NonNullable<typeof d> => d !== undefined)
                return (
                  <FlagGroupCard
                    key={group.id}
                    group={group}
                    status={status}
                    decisions={own}
                    onChoose={(kind) => decide(group, kind)}
                    onReopen={() => reopen(group)}
                    form={
                      form?.groupId === group.id ? (
                        <DecisionForm
                          group={group}
                          kind={form.kind}
                          defaultName={decidedBy}
                          onCancel={() => setForm(null)}
                          onSave={(next, name) => {
                            saveDecisions(next)
                            setDecidedBy(name)
                            setForm(null)
                            setNotice({
                              text: `Saved: ${group.cultivation} · ${group.kpi} (${next.length} ${next.length === 1 ? 'value' : 'values'}). It moved to “Decided” and the scores have been updated.`,
                              cellIds: next.map((d) => d.cellId),
                            })
                          }}
                        />
                      ) : null
                    }
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'missing' && (
        <MissingValues
          groups={visibleMissing}
          statusOf={statusOf}
          decidedBy={decidedBy}
          setDecidedBy={setDecidedBy}
          onAcknowledgeAll={acknowledgeAll}
          onAcknowledge={(g) => decidedBy.trim() && saveDecisions(buildDecisions(g.flags, { kind: 'confirm', decidedBy: decidedBy.trim(), note: 'Acknowledged: not recorded' }))}
          onReopen={reopen}
        />
      )}

      {tab === 'log' && <DecisionLog decisions={decisions} onReopen={removeDecisions} onReplace={replaceDecisions} />}
    </div>
  )
}

function MissingValues({
  groups,
  statusOf,
  decidedBy,
  setDecidedBy,
  onAcknowledgeAll,
  onAcknowledge,
  onReopen,
}: {
  groups: FlagGroup[]
  statusOf: (g: FlagGroup) => 'open' | 'partial' | 'decided'
  decidedBy: string
  setDecidedBy: (name: string) => void
  onAcknowledgeAll: (groups: FlagGroup[]) => void
  onAcknowledge: (group: FlagGroup) => void
  onReopen: (group: FlagGroup) => void
}) {
  const open = groups.filter((g) => statusOf(g) !== 'decided')
  return (
    <section className="flex flex-col gap-3" aria-label="Missing values">
      <p className="text-sm text-ink-2">
        <span className="md:hidden">
          Empty cells in the workbook. They are left out of the scores, never counted as zero. There is nothing to decide; acknowledge them to tidy the list.
        </span>
        <span className="hidden md:inline">
          These cells were empty in the workbook. An empty cell means “not recorded”, so it is left out of the scores and never counted as zero. Nothing is held back, so there is nothing you have to decide; acknowledge them to tidy the list.
        </span>
      </p>
      <div className="flex items-end gap-2 rounded-xl border border-line bg-card p-3 md:gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium md:max-w-xs">
          Your name
          <input value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-card px-2 text-base font-normal md:min-h-10 md:text-sm" />
        </label>
        <button
          type="button"
          disabled={open.length === 0 || !decidedBy.trim()}
          onClick={() => onAcknowledgeAll(open)}
          className="min-h-11 shrink-0 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50 md:min-h-10"
        >
          Acknowledge all {open.length}
          <span className="hidden sm:inline"> shown</span>
        </button>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-ink-2">No missing values match these filters.</p>
      ) : (
        <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-card shadow-sm">
          {groups.map((g) => {
            const decided = statusOf(g) === 'decided'
            return (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {g.cultivation} · {g.kpi}
                  </p>
                  <p className="text-ink-2">
                    {g.startDate === g.endDate ? formatDate(g.startDate) : formatRange(g.startDate, g.endDate)}
                    {g.flags.length > 1 ? ` · ${g.flags.length} values` : ''}
                  </p>
                </div>
                {decided ? (
                  <button type="button" onClick={() => onReopen(g)} className="min-h-9 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink-2">
                    Acknowledged · Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!decidedBy.trim()}
                    onClick={() => onAcknowledge(g)}
                    className="min-h-9 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
