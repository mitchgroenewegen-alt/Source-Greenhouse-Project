import type { Decision, DecisionKind, DecisionStore } from './types'

export const DECISIONS_KEY = 'crop-performance.decisions.v1'

const KINDS: DecisionKind[] = ['confirm', 'correct', 'exclude']

/** Is this parsed JSON a well-formed decision? Anything else in storage is ignored. */
export function isDecision(x: unknown): x is Decision {
  if (typeof x !== 'object' || x === null) return false
  const d = x as Record<string, unknown>
  const numberOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v))
  return (
    typeof d.cellId === 'string' &&
    typeof d.cultivation === 'string' &&
    typeof d.kpi === 'string' &&
    typeof d.date === 'string' &&
    (d.field === 'actual' || d.field === 'target') &&
    typeof d.rule === 'string' &&
    numberOrNull(d.originalValue) &&
    typeof d.kind === 'string' &&
    KINDS.includes(d.kind as DecisionKind) &&
    numberOrNull(d.correctedValue) &&
    typeof d.decidedBy === 'string' &&
    typeof d.decidedAt === 'string' &&
    typeof d.note === 'string'
  )
}

/** Keeps decisions in memory only. Used in tests and when the browser blocks localStorage. */
export class MemoryDecisionStore implements DecisionStore {
  protected decisions: Decision[] = []
  private listeners = new Set<() => void>()
  persistent = false

  constructor(initial: Decision[] = []) {
    this.decisions = [...initial]
  }

  getAll(): Decision[] {
    return this.decisions
  }

  save(decisions: Decision[]): void {
    const incoming = new Map(decisions.map((d) => [d.cellId, d]))
    this.commit([...this.decisions.filter((d) => !incoming.has(d.cellId)), ...incoming.values()])
  }

  remove(cellIds: string[]): void {
    const gone = new Set(cellIds)
    this.commit(this.decisions.filter((d) => !gone.has(d.cellId)))
  }

  replaceAll(decisions: Decision[]): void {
    this.commit([...decisions])
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  protected commit(next: Decision[]): void {
    this.decisions = next
    this.persist(next)
    for (const listener of this.listeners) listener()
  }

  protected persist(_decisions: Decision[]): void {}
}

/** Keeps decisions in localStorage. Every access is wrapped: if the browser refuses, it carries on in memory. */
export class LocalStorageDecisionStore extends MemoryDecisionStore {
  persistent = true

  constructor(
    private readonly getStorage: () => Storage | undefined = () => globalThis.localStorage,
    private readonly key = DECISIONS_KEY,
  ) {
    super()
    try {
      const raw = this.getStorage()?.getItem(this.key)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) this.decisions = parsed.filter(isDecision)
      }
      if (this.getStorage() === undefined) this.persistent = false
    } catch {
      this.persistent = false
    }
  }

  protected override persist(decisions: Decision[]): void {
    try {
      const storage = this.getStorage()
      if (!storage) throw new Error('no storage')
      storage.setItem(this.key, JSON.stringify(decisions))
    } catch {
      this.persistent = false
    }
  }
}

/** The store the app uses: localStorage when the browser allows it, memory otherwise. */
export function createDecisionStore(): DecisionStore {
  return new LocalStorageDecisionStore()
}
