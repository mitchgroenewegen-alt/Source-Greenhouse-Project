import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isStaleBuildError, reloadForNewBuild } from './staleBuild'

describe('isStaleBuildError', () => {
  it('recognises a missing screen file after a new deployment', () => {
    expect(
      isStaleBuildError(
        new TypeError('Failed to fetch dynamically imported module: https://x.vercel.app/assets/SignInScreen-C__0Ny1x.js'),
      ),
    ).toBe(true)
    expect(isStaleBuildError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('leaves other errors alone', () => {
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleBuildError(undefined)).toBe(false)
  })
})

describe('reloadForNewBuild', () => {
  const store = new Map<string, string>()
  const reload = vi.fn()

  beforeEach(() => {
    store.clear()
    reload.mockClear()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    vi.stubGlobal('window', { location: { reload } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reloads once, then not again straight away, so a real error is shown instead of looping', () => {
    expect(reloadForNewBuild(1_000_000)).toBe(true)
    expect(reloadForNewBuild(1_005_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads again for a later deployment', () => {
    reloadForNewBuild(1_000_000)
    expect(reloadForNewBuild(1_000_000 + 60_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload when storage is blocked, to avoid a loop', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(reloadForNewBuild(1_000_000)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
