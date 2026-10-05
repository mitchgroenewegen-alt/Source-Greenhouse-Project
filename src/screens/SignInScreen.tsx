import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../workspace/WorkspaceContext'

type Status = { step: 'idle' } | { step: 'busy' } | { step: 'done'; message: string } | { step: 'error'; message: string }

const FIELD = 'min-h-11 rounded-lg border border-line-strong bg-field px-2 text-base font-normal'
const PRIMARY = 'min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60'
const SECONDARY = 'min-h-11 rounded-lg border border-line-strong bg-field px-4 text-sm font-semibold text-ink disabled:opacity-60'
const MIN_PASSWORD = 8

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function StatusLine({ status }: { status: Status }) {
  if (status.step === 'error') {
    return (
      <p role="alert" className="text-sm font-semibold text-bad-ink">
        {status.message}
      </p>
    )
  }
  if (status.step === 'done') {
    return (
      <p role="status" className="rounded-lg border border-ok-line bg-ok-bg p-3 text-sm text-ok-ink">
        {status.message}
      </p>
    )
  }
  return null
}

/** Email and password. The field names and autocomplete hints let the browser offer to save and fill them. */
function PasswordSignInForm() {
  const { signInWithPassword, signIn } = useWorkspace()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>({ step: 'idle' })
  const [linkStatus, setLinkStatus] = useState<Status>({ step: 'idle' })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) return setStatus({ step: 'error', message: 'Please enter your email address and password.' })
    setStatus({ step: 'busy' })
    try {
      await signInWithPassword(email, password)
      setStatus({ step: 'idle' })
    } catch (error) {
      setStatus({ step: 'error', message: errorText(error, 'Signing in did not work.') })
    }
  }

  async function sendLink() {
    if (!email.trim()) return setLinkStatus({ step: 'error', message: 'Enter your email address above first.' })
    setLinkStatus({ step: 'busy' })
    try {
      await signIn(email)
      setLinkStatus({
        step: 'done',
        message: `We sent a sign-in link to ${email.trim()}. Open it on this device, then come back to Sign in to set a password, so next time you only need your email and password.`,
      })
    } catch (error) {
      setLinkStatus({ step: 'error', message: errorText(error, 'The link could not be sent.') })
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3" name="sign-in" method="post" action="#">
        <p>Sign in with the email address you were invited with and your password.</p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email address
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            inputMode="email"
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={FIELD}
          />
        </label>
        <StatusLine status={status} />
        <button type="submit" disabled={status.step === 'busy'} className={PRIMARY}>
          {status.step === 'busy' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p className="text-sm">First time here, or forgot your password? We email you a link that signs you in once; then set a password.</p>
        <StatusLine status={linkStatus} />
        <button type="button" onClick={() => void sendLink()} disabled={linkStatus.step === 'busy'} className={SECONDARY}>
          {linkStatus.step === 'busy' ? 'Sending…' : 'Email me a sign-in link'}
        </button>
      </div>
    </div>
  )
}

/** Set or change the password of the signed-in person. The hidden email field tells the browser which account to save it for. */
function SetPasswordForm({ email }: { email: string }) {
  const { setPassword } = useWorkspace()
  const [password, setValue] = useState('')
  const [repeat, setRepeat] = useState('')
  const [status, setStatus] = useState<Status>({ step: 'idle' })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD) return setStatus({ step: 'error', message: `Use at least ${MIN_PASSWORD} characters.` })
    if (password !== repeat) return setStatus({ step: 'error', message: 'The two passwords are not the same.' })
    setStatus({ step: 'busy' })
    try {
      await setPassword(password)
      setValue('')
      setRepeat('')
      setStatus({ step: 'done', message: 'Password saved. Next time, sign in with your email and this password; let your browser save it when it offers.' })
    } catch (error) {
      setStatus({ step: 'error', message: errorText(error, 'The password could not be saved.') })
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4" name="set-password" method="post" action="#">
      <h2 className="text-lg font-semibold">Set or change your password</h2>
      <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
      <label className="flex flex-col gap-1 text-sm font-medium">
        New password
        <input
          type="password"
          name="new-password"
          value={password}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="new-password"
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        New password again
        <input
          type="password"
          name="confirm-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          autoComplete="new-password"
          className={FIELD}
        />
      </label>
      <StatusLine status={status} />
      <button type="submit" disabled={status.step === 'busy'} className={PRIMARY}>
        {status.step === 'busy' ? 'Saving…' : 'Save password'}
      </button>
    </form>
  )
}

export default function SignInScreen() {
  const { sharedDatabase, user, signOut } = useWorkspace()

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
        <>
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
          <SetPasswordForm email={user} />
        </>
      ) : (
        <PasswordSignInForm />
      )}
    </div>
  )
}
