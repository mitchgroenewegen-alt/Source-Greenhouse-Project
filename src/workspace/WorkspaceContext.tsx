import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { setPassword, signInWithEmail, signInWithPassword, signOut } from './auth'
import { createWorkspaceStore } from './createStore'
import { getSupabase, supabaseSettingsProblem } from './supabaseClient'
import { isWritable, type EntityName, type WorkspaceData, type WorkspaceSnapshot, type WorkspaceStatus } from './types'

export interface Workspace {
  data: WorkspaceData
  ready: boolean
  status: WorkspaceStatus
  /** Email of the signed-in person. */
  user: string | null
  /** True when a shared database is set up for this copy of the app. */
  sharedDatabase: boolean
  /** Why the shared database settings could not be used; the app then works in this browser only. */
  settingsProblem: string | null
  canWrite: boolean
  persistent: boolean
  /** Set when a change could not be saved; the change has been undone on screen. */
  saveError: string | null
  clearSaveError: () => void
  /** Resolve to false when the change could not be saved (the reason is in `saveError`), so a form can stay open. */
  save: <K extends EntityName>(entity: K, items: WorkspaceData[K]) => Promise<boolean>
  remove: (entity: EntityName, keys: string[]) => Promise<boolean>
  signIn: (email: string) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  setPassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<Workspace | null>(null)

export function useWorkspace(): Workspace {
  const value = useContext(Ctx)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createWorkspaceStore)
  const snapshot: WorkspaceSnapshot = useSyncExternalStore((listener) => store.subscribe(listener), () => store.snapshot())
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    void store.start()
    return () => store.dispose()
  }, [store])

  const guard = useCallback(async (work: Promise<void>): Promise<boolean> => {
    try {
      await work
      return true
    } catch (error) {
      setSaveError(error instanceof Error && error.message ? error.message : 'The change could not be saved.')
      return false
    }
  }, [])

  const value = useMemo<Workspace>(
    () => ({
      data: snapshot.data,
      ready: snapshot.ready,
      status: snapshot.status,
      user: snapshot.user,
      sharedDatabase: getSupabase() !== null,
      settingsProblem: supabaseSettingsProblem(),
      canWrite: isWritable(snapshot.status),
      persistent: store.persistent,
      saveError,
      clearSaveError: () => setSaveError(null),
      save: (entity, items) => guard(store.save(entity, items)),
      remove: (entity, keys) => guard(store.remove(entity, keys)),
      signIn: signInWithEmail,
      signInWithPassword,
      setPassword,
      signOut,
    }),
    [snapshot, store, saveError, guard],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
