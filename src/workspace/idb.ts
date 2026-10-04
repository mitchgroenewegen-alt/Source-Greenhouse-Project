// A tiny key-value layer over the browser's IndexedDB (native API, no package). Every call is safe to make anywhere:
// where IndexedDB is missing or refuses (private window, tests in Node) reads give undefined and writes do nothing.

const DB_NAME = 'crop-performance'
const STORE = 'workspace'
const GIVE_UP_MS = 3000

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB is blocked'))
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>, factory: IDBFactory | undefined): Promise<T | undefined> {
  if (!factory) return undefined
  try {
    const db = await open(factory)
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = work(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } finally {
      db.close()
    }
  } catch {
    return undefined
  }
}

const defaultFactory = () => (typeof indexedDB === 'undefined' ? undefined : indexedDB)

/** Read one value. Gives up after a few seconds so a stuck database cannot hold the app on its loading screen. */
export function idbGet<T>(key: string, factory = defaultFactory()): Promise<T | undefined> {
  const giveUp = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), GIVE_UP_MS))
  return Promise.race([run<T>('readonly', (s) => s.get(key) as IDBRequest<T>, factory), giveUp])
}

export async function idbSet(key: string, value: unknown, factory = defaultFactory()): Promise<void> {
  await run('readwrite', (s) => s.put(value, key), factory)
}
