import { LocalStorageDecisionStore } from '../storage/decisionStore'
import type { DecisionStore } from '../storage/types'
import { idbGet, idbSet } from './idb'
import { MemoryWorkspaceStore } from './memoryStore'
import { ENTITIES, type EntityName, type WorkspaceData } from './types'

/**
 * The workspace kept in this browser, for when no shared database is set up (local development, a copy of the app
 * without Supabase). Decisions stay in the same localStorage place as before, so existing ones keep working; the
 * other items go to IndexedDB.
 */
export class LocalWorkspaceStore extends MemoryWorkspaceStore {
  constructor(private readonly decisionStore: DecisionStore = new LocalStorageDecisionStore()) {
    super({ decisions: decisionStore.getAll() })
    this.persistent = decisionStore.persistent
    this.state = { ...this.state, ready: false }
  }

  override async start(): Promise<void> {
    const stored = await Promise.all(ENTITIES.filter((e) => e !== 'decisions').map(async (e) => [e, await idbGet<unknown[]>(`local:${e}`)] as const))
    const data: Partial<WorkspaceData> = {}
    for (const [entity, items] of stored) if (Array.isArray(items)) Object.assign(data, { [entity]: items })
    this.update({ data: { ...this.state.data, ...data }, ready: true })
  }

  protected override persist(entity: EntityName, items: WorkspaceData[EntityName]): void {
    if (entity === 'decisions') {
      this.decisionStore.replaceAll(items as WorkspaceData['decisions'])
      this.persistent = this.decisionStore.persistent
    } else void idbSet(`local:${entity}`, items)
  }
}
