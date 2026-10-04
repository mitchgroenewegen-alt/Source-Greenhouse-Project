import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../workspace/WorkspaceContext'

export default function SignInScreen() {
  const { sharedDatabase, user, signIn, signOut } = useWorkspace()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<{ step: 'form' } | { step: 'sending' } | { step: 'sent'; email: string } | { step: 'error'; message: string }>({ step: 'form' })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim()) return setState({ step: 'error', message: 'Please enter your email address.' })
    setState({ step: 'sending' })
    try {
      await signIn(email)
      setState({ step: 'sent', email: email.trim() })
    } catch (error) {
      setState({ step: 'error', message: error instanceof Error ? error.message : 'The link could not be sent.' })
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>

      {!sharedDatabase ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <p>There is no shared database set up for this copy of the app, so there is nothing to sign in to. Decisions are kept in this browser.</p>
          <Link to="/" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-line-strong bg-field px-3 text-sm font-semibold text-ink">
            Back to the Scorecard
          </Link>
        </div>
      ) : user ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <p>
            Signed in as <strong>{user}</strong>. Decisions you make are saved to the shared database under this address.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">
              Back to the Scorecard
            </Link>
            <button type="button" onClick={() => void signOut()} className="min-h-10 rounded-lg border border-line-strong bg-field px-4 text-sm font-semibold text-ink">
              Sign out
            </button>
          </div>
        </div>
      ) : state.step === 'sent' ? (
        <div role="status" className="rounded-2xl border border-ok-line bg-ok-bg p-4 text-ok-ink">
          <p className="font-semibold">Check your email</p>
          <p>
            We sent a sign-in link to {state.email}. Open it on this device and you are signed in. It can take a minute to arrive; look in spam if it does not.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <p>Enter the email address you were invited with. We send you a link; there is no password.</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              className="min-h-11 rounded-lg border border-line-strong bg-field px-2 text-base font-normal"
            />
          </label>
          {state.step === 'error' && (
            <p role="alert" className="text-sm font-semibold text-bad-ink">
              {state.message}
            </p>
          )}
          <button type="submit" disabled={state.step === 'sending'} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">
            {state.step === 'sending' ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      )}
    </div>
  )
}
