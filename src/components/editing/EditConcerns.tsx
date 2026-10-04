import type { Concern } from '../../editing/precheck'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../ui/fields'

/** What the data checks found in the new values, with the three ways forward. */
export function EditConcerns({
  concerns,
  hasSuggestion,
  saving,
  onUseSuggestion,
  onSaveAnyway,
  onCancel,
}: {
  concerns: Concern[]
  hasSuggestion: boolean
  saving: boolean
  onUseSuggestion: () => void
  onSaveAnyway: () => void
  onCancel: () => void
}) {
  return (
    <section role="alert" aria-label="Data check on the new values" className="flex flex-col gap-2 rounded-xl border border-flag bg-flag-bg p-3 text-sm text-flag-ink">
      <h3 className="font-semibold">These values look odd</h3>
      <ul className="flex flex-col gap-2">
        {concerns.map((c, i) => (
          <li key={i}>
            <span className="block text-xs font-bold uppercase tracking-wide">{c.title}</span>
            {c.explanation}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {hasSuggestion && (
          <button type="button" onClick={onUseSuggestion} disabled={saving} className={PRIMARY_BUTTON}>
            Use suggestion
          </button>
        )}
        <button type="button" onClick={onSaveAnyway} disabled={saving} className={SECONDARY_BUTTON}>
          {saving ? 'Saving…' : 'Save anyway'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className={SECONDARY_BUTTON}>
          Cancel
        </button>
      </div>
    </section>
  )
}
