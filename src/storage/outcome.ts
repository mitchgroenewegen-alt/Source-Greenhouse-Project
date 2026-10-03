// The sentence for a decision once it is made. The card, the Decision log and the notice all use these words.

import { plain } from '../lib/format'
import { DECISION_LABEL, type Decision } from './types'

/**
 * What was decided, without the person: "Values confirmed", "Correction applied: 20.6" or, when each date got its own
 * corrected value, "Correction applied: 20.1 to 21.4", and "Excluded". Decisions made together are all of one kind;
 * an import can mix them, which reads as "Mixed decisions: ...".
 */
export function decisionWords(decisions: Decision[]): string {
  const kinds = [...new Set(decisions.map((d) => d.kind))]
  if (kinds.length === 0) return ''
  if (kinds.length > 1) return `Mixed decisions: ${kinds.map((k) => DECISION_LABEL[k]).join(', ')}`
  const kind = kinds[0]!
  if (kind !== 'correct') return DECISION_LABEL[kind]
  const values = decisions.map((d) => d.correctedValue).filter((v): v is number => v !== null)
  if (values.length === 0) return DECISION_LABEL.correct
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return `${DECISION_LABEL.correct}: ${lo === hi ? plain(lo) : `${plain(lo)} to ${plain(hi)}`}`
}

/** The outcome line of a card or log entry: "Values confirmed by Dana", "Correction applied: 20.6 by Dana", "Excluded by Dana". */
export function decisionOutcome(decisions: Decision[]): string {
  return `${decisionWords(decisions)} by ${decisions[0]?.decidedBy || 'unknown'}`
}
