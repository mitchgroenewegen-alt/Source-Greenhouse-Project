import { useEffect, useRef, useState, type FormEvent } from 'react'
import { kpiConfig } from '../../config/kpis'
import { formatDate } from '../../data/dates'
import { plain, withUnit } from '../../lib/format'
import type { FlagGroup } from '../../flags'
import { ACTION_LABEL, allHaveSuggestions, buildDecisions, type Decision, type DecisionKind } from '../../storage'

/** Per-date suggestions listed in the panel before it says "and N more" (the card's table above has every one). */
const SUGGESTIONS_LISTED = 5

/** The one sentence that says what the action will do to these values. */
function whatHappens(kind: DecisionKind, group: FlagGroup, hasSuggestions: boolean): string {
  const many = group.flags.length > 1
  const missing = group.rule === 'missing-value'
  const subject = many ? `All ${group.flags.length} values in this item are` : 'The value is'
  switch (kind) {
    case 'confirm':
      return missing
        ? 'You accept that nothing was recorded: the value stays empty and left out of the scores.'
        : `${subject} kept exactly as recorded and counted in the scores.`
    case 'exclude':
      return `${subject} left out of the scores.`
    case 'correct':
      return `${hasSuggestions ? 'The suggested correction' : 'The value you enter'} is used in the scores ${missing ? 'for the empty value' : 'in place of the recorded one'}. The workbook is not changed.`
  }
}

/** The suggested correction(s) of a group, shown so it is clear what Apply correction will save. */
function SuggestedCorrection({ group }: { group: FlagGroup }) {
  const unit = kpiConfig(group.kpi).unit
  const values = group.flags.map((f) => f.suggestion as number)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const same = lo === hi
  const perDate = group.flags.length > 1 && !same
  return (
    <div className="rounded-lg border border-line-soft bg-page/70 p-2.5 text-sm">
      <div className="text-xs font-semibold text-ink-2">Suggested correction{perDate ? ', one for each date' : ''}</div>
      <div className="num text-base font-semibold">
        {same ? withUnit(lo, unit) : `${plain(lo)} to ${withUnit(hi, unit)}`}
      </div>
      {group.suggestionNote && <div className="text-xs text-ink-2">{group.suggestionNote}</div>}
      {perDate && (
        <ul className="num mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2" aria-label="Suggested value for each date">
          {group.flags.slice(0, SUGGESTIONS_LISTED).map((f) => (
            <li key={f.id}>
              {formatDate(f.date)}: <strong className="font-semibold text-ink">{plain(f.suggestion as number)}</strong>
            </li>
          ))}
          {group.flags.length > SUGGESTIONS_LISTED && <li>and {group.flags.length - SUGGESTIONS_LISTED} more</li>}
        </ul>
      )}
    </div>
  )
}

/**
 * The compact panel that opens under an action button. All three actions share it: a sentence saying what will happen,
 * (for Apply correction) the suggested value and one plain field for a different value, the person's name, an optional
 * note, and a primary button that repeats the action's label.
 */
export function DecisionForm({
  group,
  kind,
  defaultName,
  onCancel,
  onSave,
}: {
  group: FlagGroup
  kind: DecisionKind
  defaultName: string
  onCancel: () => void
  onSave: (decisions: Decision[], name: string) => void
}) {
  const hasSuggestions = allHaveSuggestions(group.flags)
  const unit = kpiConfig(group.kpi).unit
  const [name, setName] = useState(defaultName)
  const [note, setNote] = useState('')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const label = ACTION_LABEL[kind]
  const many = group.flags.length > 1

  // The panel opens where the person just clicked; move keyboard and screen reader focus into it.
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Please add your name so the log shows who decided.')
    let value: number | 'suggestion' | undefined
    if (kind === 'correct') {
      if (typed.trim() === '' && hasSuggestions) value = 'suggestion'
      else {
        const parsed = Number(typed.trim().replace(',', '.'))
        if (typed.trim() === '' || !Number.isFinite(parsed)) return setError(hasSuggestions ? 'Enter the value as a number, or leave the field empty to use the suggestion.' : 'Enter the value as a number.')
        value = parsed
      }
    }
    onSave(buildDecisions(group.flags, { kind, decidedBy: name, note, value }), name.trim())
  }

  const valueLabel = hasSuggestions
    ? `Or type a different value${many ? ' for all dates' : ''} (${unit})`
    : `${group.rule === 'missing-value' ? 'Missing value' : 'Corrected value'}${many ? ' for all dates' : ''} (${unit})`

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl border border-line bg-page/70 p-3" aria-label={label}>
      <div>
        <h4 ref={heading} tabIndex={-1} className="font-semibold outline-none">
          {label}
        </h4>
        <p className="text-sm text-ink-2">{whatHappens(kind, group, hasSuggestions)}</p>
      </div>

      {kind === 'correct' && (
        <>
          {hasSuggestions && <SuggestedCorrection group={group} />}
          <label className="flex flex-col gap-1 text-sm font-medium">
            {valueLabel}
            <input
              inputMode="decimal"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              required={!hasSuggestions}
              aria-describedby={hasSuggestions ? `${group.id}-value-hint` : undefined}
              className="num min-h-10 w-40 rounded-lg border border-line bg-card px-2 font-normal"
            />
            {hasSuggestions && (
              <span id={`${group.id}-value-hint`} className="text-xs font-normal text-ink-2">
                Leave empty to save the suggested {many && new Set(group.flags.map((f) => f.suggestion)).size > 1 ? 'values' : 'value'}.
              </span>
            )}
          </label>
        </>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="min-h-10 rounded-lg border border-line bg-card px-2 font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Note (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="rounded-lg border border-line bg-card px-2 py-1.5 font-normal" placeholder="For example: checked with the grower, plan sheet was in °F" />
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-bad-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">
          {label}
        </button>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-ink-2">
          Cancel
        </button>
      </div>
    </form>
  )
}
