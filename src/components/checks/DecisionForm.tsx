import { useState, type FormEvent } from 'react'
import { kpiConfig } from '../../config/kpis'
import { plain } from '../../lib/format'
import type { FlagGroup } from '../../flags'
import { allHaveSuggestions, buildDecisions, type Decision, type DecisionKind } from '../../storage'

const TITLE: Record<DecisionKind, string> = {
  confirm: 'Confirm the value is correct',
  correct: 'Correct the value',
  exclude: 'Exclude the value',
}

const HELP: Record<DecisionKind, string> = {
  confirm: 'The value stays exactly as recorded and counts in the scores.',
  correct: 'The corrected value replaces the recorded one in the scores. The workbook is not changed.',
  exclude: 'The value is left out of the scores, as if it had not been recorded.',
}

/** Who / note (and the new value, for a correction) for one decision about a whole grouped item. */
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
  const [mode, setMode] = useState<'suggestion' | 'value'>(hasSuggestions ? 'suggestion' : 'value')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  const suggestions = group.flags.map((f) => f.suggestion).filter((s): s is number => s !== null)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Please add your name so the log shows who decided.')
    let value: number | 'suggestion' | undefined
    if (kind === 'correct') {
      if (mode === 'suggestion') value = 'suggestion'
      else {
        const parsed = Number(typed.replace(',', '.'))
        if (typed.trim() === '' || !Number.isFinite(parsed)) return setError('Enter the corrected value as a number.')
        value = parsed
      }
    }
    onSave(buildDecisions(group.flags, { kind, decidedBy: name, note, value }), name.trim())
  }

  const idPrefix = `${group.id}-${kind}`
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-line bg-page/70 p-3" aria-label={TITLE[kind]}>
      <div>
        <h4 className="font-semibold">{TITLE[kind]}</h4>
        <p className="text-sm text-ink-2">
          {HELP[kind]} Applies to all {group.flags.length} {group.flags.length === 1 ? 'value' : 'values'} in this item.
        </p>
      </div>

      {kind === 'correct' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">New value</legend>
          {hasSuggestions && (
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name={`${idPrefix}-mode`} checked={mode === 'suggestion'} onChange={() => setMode('suggestion')} className="mt-1 size-4" />
              <span>
                Use the suggested {suggestions.length === 1 ? 'value' : 'values'}:{' '}
                <strong className="num">
                  {Math.min(...suggestions) === Math.max(...suggestions)
                    ? plain(suggestions[0]!)
                    : `${plain(Math.min(...suggestions))} to ${plain(Math.max(...suggestions))}`}{' '}
                  {unit}
                </strong>
                {group.suggestionNote && <span className="text-ink-3"> ({group.suggestionNote})</span>}
              </span>
            </label>
          )}
          <label className="flex flex-wrap items-center gap-2 text-sm">
            {hasSuggestions && (
              <input type="radio" name={`${idPrefix}-mode`} checked={mode === 'value'} onChange={() => setMode('value')} className="size-4" aria-label="Enter a value" />
            )}
            <span>{hasSuggestions ? 'Or enter a value' : 'Enter the correct value'} ({unit})</span>
            <input
              inputMode="decimal"
              value={typed}
              onFocus={() => setMode('value')}
              onChange={(e) => {
                setTyped(e.target.value)
                setMode('value')
              }}
              className="num min-h-10 w-32 rounded-lg border border-line bg-card px-2"
            />
          </label>
        </fieldset>
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
          Save decision
        </button>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-ink-2">
          Cancel
        </button>
      </div>
    </form>
  )
}
