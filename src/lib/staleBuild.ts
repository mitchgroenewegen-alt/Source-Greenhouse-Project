/**
 * After a new deployment the file names of the screens change. A page (or installed app) still running the old
 * build then asks for a screen file that no longer exists, and the import fails. Reloading picks up the new build.
 */

const KEY = 'crop-performance:stale-build-reload'
/** A second failure this soon after a reload is a real error, not an old build, so it is shown instead of looping. */
const MIN_GAP_MS = 30_000

export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    message,
  )
}

function readLast(): number {
  try {
    return Number(sessionStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}

/** Reloads the page once to fetch the new build. Returns false (and does nothing) if it already tried just now. */
export function reloadForNewBuild(now = Date.now()): boolean {
  if (now - readLast() < MIN_GAP_MS) return false
  try {
    sessionStorage.setItem(KEY, String(now))
  } catch {
    // Without storage the gap check cannot work, so do not risk a reload loop.
    return false
  }
  window.location.reload()
  return true
}

/** Vite fires this event when a lazily loaded file fails to load; reload instead of showing the error. */
export function listenForStaleBuild(): void {
  window.addEventListener('vite:preloadError', () => {
    reloadForNewBuild()
  })
}
