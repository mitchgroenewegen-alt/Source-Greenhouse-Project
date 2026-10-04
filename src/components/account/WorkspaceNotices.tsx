import { useState } from 'react'
import { Link } from 'react-router-dom'
import { readPreference, writePreference, type Decision } from '../../storage'
import { LocalStorageDecisionStore } from '../../storage/decisionStore'
import { useCropData } from '../../state/CropDataContext'
import { useWorkspace } from '../../workspace/WorkspaceContext'

const NOTICE = 'border-t border-warn-line bg-warn-bg px-4 py-1.5 text-center text-sm text-warn-ink'

/** Offered once, the first time someone signs in on a browser that holds decisions from before the shared database. */
function UploadOldDecisions() {
  const { saveDecisions, decisionById } = useCropData()
  const [old] = useState<Decision[]>(() => new LocalStorageDecisionStore().getAll())
  const [answered, setAnswered] = useState(() => readPreference('oldDecisionsOffered', false))
  if (answered || old.length === 0) return null
  const answer = () => {
    writePreference('oldDecisionsOffered', true)
    setAnswered(true)
  }
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-2 border-t border-ok-line bg-ok-bg px-4 py-1.5 text-sm text-ok-ink">
      <span>
        This browser has {old.length} {old.length === 1 ? 'decision' : 'decisions'} saved from before the shared database. Upload {old.length === 1 ? 'it' : 'them'} so everyone sees {old.length === 1 ? 'it' : 'them'}?
      </span>
      <button
        type="button"
        onClick={() => {
          // A cell someone has already decided in the shared database keeps its decision.
          saveDecisions(old.filter((d) => !decisionById.has(d.cellId)))
          answer()
        }}
        className="min-h-9 rounded-lg border border-ok-line bg-field px-3 font-semibold"
      >
        Upload
      </button>
      <button type="button" onClick={answer} className="min-h-9 rounded-lg px-2 font-semibold">
        No thanks
      </button>
    </div>
  )
}

/** Banners about the shared database: signed out, out of reach, a change that could not be saved, old decisions. */
export function WorkspaceNotices() {
  const { status, user, saveError, clearSaveError, settingsProblem } = useWorkspace()
  return (
    <>
      {settingsProblem && (
        <p role="status" className={NOTICE}>
          The shared database settings could not be used, so changes stay in this browser. {settingsProblem}
        </p>
      )}
      {status === 'signed-out' && (
        <p role="status" className={NOTICE}>
          You are not signed in, so you see the workbook data only and cannot record decisions.{' '}
          <Link to="/sign-in" className="font-semibold underline">
            Sign in
          </Link>
        </p>
      )}
      {status === 'offline-readonly' && (
        <p role="status" className={NOTICE}>
          Can't reach the shared database. Showing the last saved copy, read-only.
        </p>
      )}
      {saveError && (
        <p role="alert" className="border-t border-bad-line bg-bad-bg px-4 py-1.5 text-center text-sm text-bad-ink">
          The change was not saved: {saveError}{' '}
          <button type="button" onClick={clearSaveError} className="font-semibold underline">
            Dismiss
          </button>
        </p>
      )}
      {status === 'online' && user && <UploadOldDecisions />}
    </>
  )
}
