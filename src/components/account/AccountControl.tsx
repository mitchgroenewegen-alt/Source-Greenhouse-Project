import { Link } from 'react-router-dom'
import { useWorkspace } from '../../workspace/WorkspaceContext'

/** The small sign-in control in the header. Not shown when there is no shared database to sign in to. */
export function AccountControl() {
  const { sharedDatabase, user, signOut } = useWorkspace()
  if (!sharedDatabase) return null
  if (!user) {
    return (
      <Link to="/sign-in" className="flex min-h-10 items-center rounded-lg border border-line-strong bg-field px-3 text-sm font-semibold text-ink">
        Sign in
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Link to="/sign-in" className="hidden max-w-[12rem] truncate text-sm font-medium text-ink-2 sm:block" title={user}>
        {user}
      </Link>
      <button type="button" onClick={() => void signOut()} className="min-h-10 rounded-lg border border-line-strong bg-field px-3 text-sm font-semibold text-ink">
        Sign out
      </button>
    </div>
  )
}
