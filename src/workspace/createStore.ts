import { LocalWorkspaceStore } from './localStore'
import { SupabaseWorkspaceStore } from './supabaseStore'
import { getSupabase } from './supabaseClient'
import type { WorkspaceStore } from './types'

/** The shared database when it is set up, otherwise this browser's own storage. */
export function createWorkspaceStore(): WorkspaceStore {
  const client = getSupabase()
  return client ? new SupabaseWorkspaceStore(client) : new LocalWorkspaceStore()
}
