import type { RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js'
import { idbGet, idbSet } from './idb'
import { MemoryWorkspaceStore } from './memoryStore'
import { emptyWorkspace, ENTITIES, isWritable, WorkspaceReadOnlyError, type EntityName, type WorkspaceData } from './types'

/** How each entity is kept in the database: its table, the columns that identify a row and the fields it stores. */
interface TableSpec {
  table: string
  keyColumns: string[]
  /** Fields of the entity, in camelCase; the column is the snake_case of the name. */
  fields: string[]
}

const TABLES: Record<EntityName, TableSpec> = {
  facilities: { table: 'facilities', keyColumns: ['id'], fields: ['id', 'name', 'region', 'currency'] },
  greenhouses: { table: 'greenhouses', keyColumns: ['id'], fields: ['id', 'facilityId', 'name', 'areaM2', 'ledWattsPerM2'] },
  cultivations: {
    table: 'cultivations',
    keyColumns: ['id'],
    fields: ['id', 'facility', 'greenhouse', 'crop', 'variety', 'plantingDate', 'areaM2', 'cropWeekAtEnd', 'fruitType', 'plannedEndDate', 'archived'],
  },
  valueEdits: {
    table: 'value_edits',
    keyColumns: ['id'],
    fields: ['id', 'cultivation', 'kpi', 'dateFrom', 'dateTo', 'field', 'newValue', 'originalValue', 'createdBy', 'createdAt', 'reason', 'source'],
  },
  enteredRows: {
    table: 'entered_rows',
    keyColumns: ['cultivation', 'kpi', 'date'],
    fields: ['cultivation', 'date', 'kpi', 'actual', 'target', 'createdBy', 'createdAt', 'source'],
  },
  fruitTypes: {
    table: 'fruit_types',
    keyColumns: ['id'],
    fields: ['id', 'name', 'weightMinG', 'weightMaxG', 'diameterMinMm', 'diameterMaxMm', 'pricePerKg', 'placeholder'],
  },
  rates: { table: 'rates', keyColumns: ['facility_id'], fields: ['facilityId', 'heatPerKwh', 'electricityPerKwh', 'waterPerM3'] },
  decisions: {
    table: 'decisions',
    keyColumns: ['cell_id'],
    fields: ['cellId', 'cultivation', 'kpi', 'date', 'field', 'rule', 'originalValue', 'kind', 'correctedValue', 'decidedBy', 'decidedAt', 'note'],
  },
}

const snake = (name: string) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

/**
 * Who made a change is stored as text (the email) in created_by_name: the plain created_by column is the user's id,
 * filled in by the database itself.
 */
const column = (field: string) => (field === 'createdBy' ? 'created_by_name' : snake(field))

type Row = Record<string, unknown>

function toRow(spec: TableSpec, item: unknown): Row {
  const row: Row = {}
  for (const field of spec.fields) row[column(field)] = (item as Row)[field] ?? null
  return row
}

function fromRow(spec: TableSpec, row: Row): unknown {
  const item: Row = {}
  for (const field of spec.fields) {
    const value = row[column(field)]
    // Timestamps come back in the database's own notation; keep one notation in the app.
    item[field] = field.endsWith('At') && typeof value === 'string' ? new Date(value).toISOString() : (value ?? null)
  }
  return item
}

/** Split a composite key (see ENTITY_KEY) back into the columns that make it up. */
function keyParts(entity: EntityName, key: string): string[] {
  return entity === 'enteredRows' ? key.split('|') : [key]
}

/** Give up on the network after this long and fall back to the saved copy. */
const LOAD_TIMEOUT_MS = 8000
const CACHE_KEY = 'shared-cache'
const REFETCH_DELAY_MS = 200
const DELETE_CHUNK = 50

/**
 * The workspace in the shared Supabase database. Everything here is kept small and behind WorkspaceStore:
 * sign-in state decides the status, writes go to the database and into the snapshot at once, other people's changes
 * arrive through realtime, and a copy of the last load is kept in IndexedDB for when the database cannot be reached.
 */
export class SupabaseWorkspaceStore extends MemoryWorkspaceStore {
  private channel: RealtimeChannel | null = null
  private timers = new Map<EntityName, ReturnType<typeof setTimeout>>()
  private unsubscribeAuth: (() => void) | null = null
  private onOnline = () => {
    if (this.state.status === 'offline-readonly') void this.connect()
  }

  constructor(private readonly client: SupabaseClient) {
    super({}, 'signed-out')
    this.persistent = true
    this.state = { ...this.state, ready: false }
  }

  override start(): Promise<void> {
    return new Promise((resolve) => {
      let first = true
      const { data } = this.client.auth.onAuthStateChange((_event, session) => {
        // Not awaited inside the callback: the auth library holds a lock while it runs.
        setTimeout(() => {
          void this.onSession(session).then(() => {
            if (first) resolve()
            first = false
          })
        }, 0)
      })
      this.unsubscribeAuth = () => data.subscription.unsubscribe()
      globalThis.addEventListener?.('online', this.onOnline)
    })
  }

  override dispose(): void {
    this.unsubscribeAuth?.()
    this.stopRealtime()
    globalThis.removeEventListener?.('online', this.onOnline)
  }

  private async onSession(session: Session | null): Promise<void> {
    const email = session?.user.email ?? null
    if (!session) {
      this.stopRealtime()
      // Signed out: only the workbook is shown. The shared data is for signed-in people.
      this.update({ data: emptyWorkspace(), status: 'signed-out', user: null, ready: true })
      return
    }
    if (this.state.user === email && this.state.status === 'online') return // token refresh, nothing changed
    this.update({ user: email })
    await this.connect()
  }

  /** Load everything from the database; on failure show the saved copy, read-only. */
  private async connect(): Promise<void> {
    try {
      const data = await Promise.race([
        this.fetchAll(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS)),
      ])
      this.update({ data, status: 'online', ready: true })
      void idbSet(CACHE_KEY, data)
      this.startRealtime()
    } catch {
      this.stopRealtime()
      const cached = await idbGet<WorkspaceData>(CACHE_KEY)
      this.update({ data: { ...emptyWorkspace(), ...cached }, status: 'offline-readonly', ready: true })
    }
  }

  private async fetchTable<K extends EntityName>(entity: K): Promise<WorkspaceData[K]> {
    const spec = TABLES[entity]
    const { data, error } = await this.client.from(spec.table).select('*')
    if (error) throw error
    return (data as Row[]).map((row) => fromRow(spec, row)) as WorkspaceData[K]
  }

  private async fetchAll(): Promise<WorkspaceData> {
    const entries = await Promise.all(ENTITIES.map(async (entity) => [entity, await this.fetchTable(entity)] as const))
    return { ...emptyWorkspace(), ...Object.fromEntries(entries) }
  }

  private startRealtime(): void {
    if (this.channel) return
    let channel = this.client.channel('workspace')
    for (const entity of ENTITIES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: TABLES[entity].table }, () => this.refetchSoon(entity))
    }
    this.channel = channel.subscribe()
  }

  private stopRealtime(): void {
    if (this.channel) void this.client.removeChannel(this.channel)
    this.channel = null
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }

  /** A change happened somewhere (maybe here): read that table again, once for a burst of changes. */
  private refetchSoon(entity: EntityName): void {
    clearTimeout(this.timers.get(entity))
    this.timers.set(
      entity,
      setTimeout(async () => {
        try {
          const items = await this.fetchTable(entity)
          this.update({ data: { ...this.state.data, [entity]: items } })
          void idbSet(CACHE_KEY, this.state.data)
        } catch {
          // The next change or reconnect will catch up.
        }
      }, REFETCH_DELAY_MS),
    )
  }

  override async save<K extends EntityName>(entity: K, items: WorkspaceData[K]): Promise<void> {
    this.assertWritable()
    const spec = TABLES[entity]
    const previous = this.state.data[entity]
    await super.save(entity, items) // shows the change at once
    const { error } = await this.client.from(spec.table).upsert((items as unknown[]).map((item) => toRow(spec, item)), { onConflict: spec.keyColumns.join(',') })
    if (error) {
      this.setItems(entity, previous)
      throw error
    }
  }

  override async remove(entity: EntityName, keys: string[]): Promise<void> {
    this.assertWritable()
    const spec = TABLES[entity]
    const previous = this.state.data[entity]
    await super.remove(entity, keys)
    const single = spec.keyColumns.length === 1
    // One request per chunk of keys when the key is one column; one per item for the composite key.
    const chunks = single ? Array.from({ length: Math.ceil(keys.length / DELETE_CHUNK) }, (_, i) => keys.slice(i * DELETE_CHUNK, (i + 1) * DELETE_CHUNK)) : keys.map((k) => [k])
    for (const chunk of chunks) {
      let query = this.client.from(spec.table).delete()
      if (single) query = query.in(spec.keyColumns[0]!, chunk)
      else {
        const parts = keyParts(entity, chunk[0]!)
        spec.keyColumns.forEach((col, i) => (query = query.eq(col, parts[i]!)))
      }
      const { error } = await query
      if (error) {
        this.setItems(entity, previous)
        throw error
      }
    }
  }

  protected override assertWritable(): void {
    if (!isWritable(this.state.status)) throw new WorkspaceReadOnlyError(this.state.status)
  }
}

/** The row mapping, exported for tests (no network needed). */
export const tableSpec = (entity: EntityName) => TABLES[entity]
export { toRow as itemToRow, fromRow as rowToItem }
