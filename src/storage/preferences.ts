// Small per-viewer conveniences (your name, the raw-data switch). Never used for anything that must persist reliably.

const PREFIX = 'crop-performance.pref.'

export function readPreference<T>(name: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + name)
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writePreference(name: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + name, JSON.stringify(value))
  } catch {
    // Private window or blocked storage: the page keeps working, it just forgets next time.
  }
}
