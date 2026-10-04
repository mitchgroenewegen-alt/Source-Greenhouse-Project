import { Component, type ErrorInfo, type ReactNode } from 'react'

/** If anything throws while drawing the app, say what went wrong instead of leaving an empty page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main className="mx-auto max-w-lg p-6 text-ink">
        <div role="alert" className="rounded-xl border border-line-strong bg-card p-5">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2">The app hit an error and could not show this page.</p>
          <p className="mt-2 break-words rounded-lg bg-field p-3 font-mono text-sm">{error.message}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-brand px-4 py-2 font-medium text-white">
            Reload
          </button>
        </div>
      </main>
    )
  }
}
