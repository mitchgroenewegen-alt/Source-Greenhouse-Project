import { useEffect, useMemo, useRef, useState } from 'react'
import { planWord, type KpiConfig } from '../../config/kpis'
import { formatDate, formatRange, shortWeek } from '../../data/dates'
import type { Cultivation, DailyRow, WeekInfo } from '../../data/types'
import { changesNothing, lastDataDate, planEdit, requestProblem, seriesOf, toValueEdits, type DayChange, type EditPlan, type EditRequest } from '../../editing/plan'
import { precheckChanges, type PrecheckResult } from '../../editing/precheck'
import { useCropData } from '../../state/CropDataContext'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import type { ValueEdit } from '../../workspace/types'
import { WriteNotice } from '../setup/WriteNotice'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SelectField, TextField } from '../ui/fields'
import { Segmented } from '../ui/Segmented'
import { EditConcerns } from './EditConcerns'
import { EditPreview } from './EditPreview'

type Mode = 'week' | 'from' | 'scale'
const MODE_LABEL: Record<Mode, string> = { week: 'One week', from: 'From a week onward', scale: 'Scale a range' }

/** "12,5" and "12.5" both work; anything else is not a number. */
const toNumber = (text: string) => (text.trim() === '' ? NaN : Number(text.trim().replace(',', '.')))

/** What the data checks said about a save in waiting: the changes it would make and what was found. */
interface Pending {
  changes: DayChange[]
  result: PrecheckResult
}

/**
 * Edits the budget or target of one KPI of one cultivation, in a sheet over the screen: one week, from a week onward, or
 * scaling a range of weeks by a percentage. The value typed is a weekly one; it is translated to daily values and saved
 * as value edits (the workbook is not changed), after the data checks have looked at it.
 */
export function BudgetEditor({
  config,
  cultivation,
  daily,
  weeks,
  selectedWeek,
  createdBy,
  onSave,
  onClose,
}: {
  config: KpiConfig
  cultivation: Cultivation
  /** The merged daily rows. */
  daily: DailyRow[]
  weeks: WeekInfo[]
  selectedWeek: string
  createdBy: string
  onSave: (edits: ValueEdit[]) => Promise<boolean>
  onClose: () => void
}) {
  const { canWrite, signedInAs, decidedBy, setDecidedBy } = useCropData()
  const { saveError } = useWorkspace()
  const plan = planWord(config)
  const series = useMemo(() => seriesOf(daily, cultivation.id, config.name), [daily, cultivation.id, config.name])
  const lastDate = useMemo(() => lastDataDate(daily, cultivation.id), [daily, cultivation.id])
  // Only weeks in which this KPI has days can be picked.
  const choices = useMemo(() => {
    const have = new Set(series.map((r) => r.week))
    return weeks.filter((w) => have.has(w.id))
  }, [series, weeks])
  const options = choices.map((w) => ({ value: w.id, label: `${shortWeek(w.id)}, ${formatRange(w.start, w.end)}` }))

  const firstWeek = choices.find((w) => w.id === selectedWeek)?.id ?? choices[0]?.id ?? ''
  const lastWeek = choices[choices.length - 1]?.id ?? ''
  const [mode, setMode] = useState<Mode>('week')
  const [week, setWeek] = useState(firstWeek)
  const [toWeek, setToWeek] = useState(lastWeek)
  const [value, setValue] = useState('')
  const [percent, setPercent] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const request: EditRequest | null = useMemo(() => {
    if (week === '') return null
    if (mode === 'week') return { mode, week, value: toNumber(value) }
    if (mode === 'from') return { mode, week, value: toNumber(value), endDate: cultivation.plannedEndDate ?? null }
    return { mode, fromWeek: week, toWeek: toWeek || week, percent: toNumber(percent) }
  }, [mode, week, toWeek, value, percent, cultivation.plannedEndDate])
  const edit: EditPlan = useMemo(() => (request ? planEdit(series, config.aggregation, request, lastDate) : { changes: [], weeks: [], rangeEnd: null }), [request, series, config.aggregation, lastDate])

  const typed = mode === 'scale' ? percent : value
  const problem = typed.trim() === '' ? 'Type a value first.' : requestProblem(request, edit.changes.length > 0)
  const nothing = !problem && changesNothing(edit)
  const needsName = signedInAs === null && decidedBy.trim() === ''
  const cannotSave = !canWrite || saving || problem !== null || nothing || needsName

  // Anything typed after a warning makes it out of date.
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setPending(null)
    setFailed(false)
    set(v)
  }

  async function save(changes: DayChange[]) {
    setSaving(true)
    const edits = toValueEdits(changes, { cultivation: cultivation.id, kpi: config.name, createdBy, createdAt: new Date().toISOString(), reason, rangeEnd: edit.rangeEnd })
    const saved = await onSave(edits)
    setSaving(false)
    if (saved) onClose()
    else setFailed(true)
  }

  function submit() {
    const result = precheckChanges(series, cultivation, edit.changes)
    if (result.concerns.length > 0) setPending({ changes: edit.changes, result })
    else void save(edit.changes)
  }

  function useSuggestion() {
    if (!pending?.result.suggested) return
    const changes = pending.result.suggested
    const result = precheckChanges(series, cultivation, changes)
    if (result.concerns.length > 0) setPending({ changes, result })
    else void save(changes)
  }

  const title = `Edit ${plan}: ${config.name}`
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-2xl border border-line bg-card p-4 shadow-lg md:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            <p className="text-xs text-ink-3">
              {cultivation.id} · {config.unit}
            </p>
          </div>
          <button ref={closeButton} type="button" onClick={onClose} className={SECONDARY_BUTTON}>
            Close
          </button>
        </header>

        <WriteNotice what={`edit a ${plan}`} />

        {choices.length === 0 ? (
          <p className="text-sm">This cultivation has no days for {config.name} yet, so there is nothing to edit.</p>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (!cannotSave && !pending) submit()
            }}
            className="flex flex-col gap-3"
          >
            <Segmented
              label="What to change"
              options={(['week', 'from', 'scale'] as const).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
              value={mode}
              onChange={touch(setMode)}
            />

            <SelectField label={mode === 'scale' ? 'First week' : mode === 'from' ? 'From week' : 'Week'} value={week} onChange={touch(setWeek)} options={options} />
            {mode === 'scale' && <SelectField label="Last week" value={toWeek} onChange={touch(setToWeek)} options={options} />}

            {mode === 'scale' ? (
              <TextField label="Change in percent" value={percent} onChange={touch(setPercent)} inputMode="decimal" hint={`+10 raises every daily ${plan} in these weeks by 10 %; -5 lowers it by 5 %.`} />
            ) : (
              <TextField
                label={`New weekly ${plan} (${config.unit})`}
                value={value}
                onChange={touch(setValue)}
                inputMode="decimal"
                hint={
                  config.aggregation === 'sum'
                    ? `The weekly ${plan} is a total, so it is spread over the days of the week in proportion to the daily ${plan}s they have now.`
                    : config.aggregation === 'average'
                      ? `The weekly ${plan} is an average, so every day of the week gets this value.`
                      : `The weekly ${plan} is the last value of the week, so every day of the week gets this value.`
                }
              />
            )}
            {mode === 'from' && (
              <p className="text-xs text-ink-2">
                Applies from {shortWeek(week)} to {cultivation.plannedEndDate ? `the planned end, ${formatDate(cultivation.plannedEndDate)}` : lastDate ? `the last day with data, ${formatDate(lastDate)}` : 'the last day with data'}. Days with no row yet are not added.
              </p>
            )}

            <TextField label="Reason (optional)" value={reason} onChange={touch(setReason)} hint='Left empty it is saved as "Edited".' />
            {signedInAs === null && <TextField label="Your name" value={decidedBy} onChange={setDecidedBy} hint="Saved with the edit." error={needsName ? 'Type your name so the edit log can show who made it.' : undefined} />}

            {!problem && <EditPreview config={config} weeks={edit.weeks} />}
            {problem && typed.trim() !== '' && (
              <p role="status" className="text-sm font-semibold text-bad-ink">
                {problem}
              </p>
            )}
            {nothing && <p role="status" className="text-sm">The {plan} already has this value, so there is nothing to save.</p>}

            {pending && (
              <EditConcerns
                concerns={pending.result.concerns}
                hasSuggestion={pending.result.suggested !== null}
                saving={saving}
                onUseSuggestion={useSuggestion}
                onSaveAnyway={() => void save(pending.changes)}
                onCancel={() => setPending(null)}
              />
            )}
            {failed && <p role="alert" className="text-sm font-semibold text-bad-ink">The change was not saved{saveError ? `: ${saveError}` : '.'}</p>}

            {!pending && (
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={cannotSave} className={PRIMARY_BUTTON}>
                  {saving ? 'Saving…' : `Save ${plan}`}
                </button>
                <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
                  Cancel
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
