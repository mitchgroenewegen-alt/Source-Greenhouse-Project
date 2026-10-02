import type { Flag } from '../flags'
import type { Decision, DecisionKind } from './types'

export interface DecisionInput {
  kind: DecisionKind
  decidedBy: string
  note: string
  /** For 'correct': one value for every cell, or 'suggestion' to use each cell's own suggested correction. */
  value?: number | 'suggestion'
  now?: Date
}

/** Can this set of flags be corrected with their own suggestions? */
export function allHaveSuggestions(flags: Flag[]): boolean {
  return flags.length > 0 && flags.every((f) => f.suggestion !== null)
}

/** One decision per flagged cell, all stamped with the same person, time and note. */
export function buildDecisions(flags: Flag[], input: DecisionInput): Decision[] {
  const decidedAt = (input.now ?? new Date()).toISOString()
  return flags.map((flag) => {
    let correctedValue: number | null = null
    if (input.kind === 'correct') {
      const value = input.value === 'suggestion' ? flag.suggestion : (input.value ?? null)
      if (value === null || !Number.isFinite(value)) throw new Error(`No corrected value for ${flag.id}`)
      correctedValue = value
    }
    return {
      cellId: flag.id,
      cultivation: flag.cultivation,
      kpi: flag.kpi,
      date: flag.date,
      field: flag.field,
      rule: flag.rule,
      originalValue: flag.value,
      kind: input.kind,
      correctedValue,
      decidedBy: input.decidedBy.trim(),
      decidedAt,
      note: input.note.trim(),
    }
  })
}
