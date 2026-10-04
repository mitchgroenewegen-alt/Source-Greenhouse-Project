import { Link } from 'react-router-dom'
import { useWorkspace } from '../../workspace/WorkspaceContext'

/** Shown above a screen that changes things, while the workspace is read-only (signed out, or the shared database is out of reach). */
export function WriteNotice({ what }: { what: string }) {
  const { canWrite, status } = useWorkspace()
  if (canWrite) return null
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warn-line bg-warn-bg p-3 text-sm text-warn-ink">
      <span>
        {status === 'signed-out'
          ? `Sign in to ${what}. Until then this screen is read-only.`
          : `Changes can't be saved while the shared database is out of reach.`}
      </span>
      {status === 'signed-out' && (
        <Link to="/sign-in" className="inline-flex min-h-9 items-center rounded-lg border border-warn-line bg-field px-3 font-semibold">
          Sign in
        </Link>
      )}
    </div>
  )
}
