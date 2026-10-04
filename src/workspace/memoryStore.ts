import { emptyWorkspace, ENTITY_KEY, isWritable, WorkspaceReadOnlyError, type EntityName, type WorkspaceData, type WorkspaceSnapshot, type WorkspaceStatus, type WorkspaceStore } from './types'

/** Keeps the workspace in memory only. Used in tests; LocalWorkspaceStore builds on it. */
export class MemoryWorkspaceStore implements WorkspaceStore {
  protected state: WorkspaceSnapshot
  private listeners = new Set<() => void>()
  persistent = false

  constructor(initial: Partial<WorkspaceData> = {}, status: WorkspaceStatus = 'local') {
    this.state = { data: { ...emptyWorkspace(), ...initial }, status, user: null, ready: true }
  }

  async start(): Promise<void> {}

  snapshot(): WorkspaceSnapshot {
    return this.state
  }

  async save<K extends EntityName>(entity: K, items: WorkspaceData[K]): Promise<void> {
    this.assertWritable()
    const keyOf = ENTITY_KEY[entity] as (item: unknown) => string
    const incoming = new Map((items as unknown[]).map((item) => [keyOf(item), item]))
    const kept = (this.state.data[entity] as unknown[]).filter((item) => !incoming.has(keyOf(item)))
    this.setItems(entity, [...kept, ...incoming.values()] as WorkspaceData[K])
  }

  async remove(entity: EntityName, keys: string[]): Promise<void> {
    this.assertWritable()
    const keyOf = ENTITY_KEY[entity] as (item: unknown) => string
    const gone = new Set(keys)
    this.setItems(entity, (this.state.data[entity] as unknown[]).filter((item) => !gone.has(keyOf(item))) as WorkspaceData[EntityName])
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {}

  protected assertWritable(): void {
    if (!isWritable(this.state.status)) throw new WorkspaceReadOnlyError(this.state.status)
  }

  protected setItems<K extends EntityName>(entity: K, items: WorkspaceData[K]): void {
    this.update({ data: { ...this.state.data, [entity]: items } })
    this.persist(entity, items)
  }

  /** Replace parts of the snapshot (a new object, so React sees the change) and tell listeners. */
  protected update(patch: Partial<WorkspaceSnapshot>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  protected persist(_entity: EntityName, _items: WorkspaceData[EntityName]): void {}
}
