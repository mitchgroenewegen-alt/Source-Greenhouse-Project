import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCropData } from '../../state/CropDataContext'
import { EditConcerns } from '../editing/EditConcerns'
import { WriteNotice } from '../setup/WriteNotice'
import { PRIMARY_BUTTON, TextField } from '../ui/fields'
import type { EntryFlow } from './useEntryFlow'

/**
 * The frame of an Enter data form: the fields, the name when nobody is signed in, what the data checks found with its three
 * ways forward, the result of saving, and the Save button. `onSubmit` hands the typed values to the flow.
 */
export function EntryFormCard({
  title,
  intro,
  flow,
  problem,
  showProblem,
  submitLabel,
  onSubmit,
  onSaved,
  children,
}: {
  title: string
  intro: string
  flow: EntryFlow
  /** Why nothing can be saved yet, or null. It is only said out loud once something has been typed (`showProblem`). */
  problem: string | null
  showProblem: boolean
  submitLabel: string
  onSubmit: () => Promise<boolean>
  /** Called once the values are saved, to empty the form. */
  onSaved: () => void
  children: ReactNode
}) {
  const { canWrite, signedInAs, decidedBy, setDecidedBy } = useCropData()
  const needsName = signedInAs === null && decidedBy.trim() === ''
  const cannotSave = !canWrite || flow.saving || problem !== null || needsName

  async function run(action: () => Promise<boolean>) {
    if (await action()) onSaved()
  }

  return (
    <form
      noValidate
      aria-label={title}
      onSubmit={(e) => {
        e.preventDefault()
        if (!cannotSave && !flow.pending) void run(onSubmit)
      }}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-ink-2">{intro}</p>
      </div>
      <WriteNotice what="enter data" />
      {children}
      {signedInAs === null && (
        <TextField label="Your name" value={decidedBy} onChange={setDecidedBy} hint="Saved with the entry." error={needsName ? 'Type your name so the edit log can show who entered the values.' : undefined} />
      )}

      {problem && showProblem && <p role="status" className="text-sm font-semibold text-bad-ink">{problem}</p>}

      {flow.pending && (
        <EditConcerns
          concerns={flow.pending.concerns}
          hasSuggestion={flow.pending.suggested !== null}
          saving={flow.saving}
          onUseSuggestion={() => void run(flow.useSuggestion)}
          onSaveAnyway={() => void run(flow.saveAnyway)}
          onCancel={flow.cancel}
        />
      )}
      {flow.failed && <p role="alert" className="text-sm font-semibold text-bad-ink">The values were not saved{flow.saveError ? `: ${flow.saveError}` : '.'}</p>}
      {flow.saved && (
        <p role="status" className="rounded-xl border border-ok-line bg-ok-bg p-2.5 text-sm text-ok-ink">
          {flow.saved}{' '}
          <Link to="/edits" className="font-semibold underline">
            See the edit log
          </Link>{' '}
          to undo them.
        </p>
      )}

      {!flow.pending && (
        <div>
          <button type="submit" disabled={cannotSave} className={PRIMARY_BUTTON}>
            {flow.saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      )}
    </form>
  )
}
