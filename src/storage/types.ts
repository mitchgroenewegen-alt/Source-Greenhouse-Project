import type { Field, RuleId } from '../flags'

/** What a person decided about a flagged value. */
export type DecisionKind = 'confirm' | 'correct' | 'exclude'

/**
 * The three actions, worded exactly as the buttons say them. The stored ids (confirm, correct, exclude) never change,
 * so the CSV format and old exports stay as they were; only the words people read are these.
 */
export const ACTION_LABEL: Record<DecisionKind, string> = {
  confirm: 'Confirm values',
  correct: 'Apply correction',
  exclude: 'Exclude',
}

/** What a decision is called once it is made: on the card, in the decision log and in the filters. */
export const DECISION_LABEL: Record<DecisionKind, string> = {
  confirm: 'Values confirmed',
  correct: 'Correction applied',
  exclude: 'Excluded',
}

/** One decision about one cell of the KPIs sheet. A grouped item in the UI writes one of these per cell. */
export interface Decision {
  /** The cell: "PA-P2-TOV|Temperature (24h)|2025-07-01|target". Same as Flag.id. */
  cellId: string
  cultivation: string
  kpi: string
  date: string
  field: Field
  /** The rule that flagged the cell when the decision was made. */
  rule: RuleId
  /** The value as recorded in the workbook; null if nothing was recorded. */
  originalValue: number | null
  kind: DecisionKind
  /** Only for kind 'correct'. */
  correctedValue: number | null
  /** Who decided (free text). */
  decidedBy: string
  /** When, as an ISO timestamp. */
  decidedAt: string
  note: string
}

/** Where verification decisions live. The screens only know this interface. */
export interface DecisionStore {
  /** Every decision. A new array on each change, so it can be used as a React snapshot. */
  getAll(): Decision[]
  /** Add decisions, replacing any earlier decision about the same cell. */
  save(decisions: Decision[]): void
  /** Take the decisions about these cells back (the values become open again). */
  remove(cellIds: string[]): void
  /** Replace everything, e.g. after an import. */
  replaceAll(decisions: Decision[]): void
  /** Call back after every change. Returns the function that stops listening. */
  subscribe(listener: () => void): () => void
  /** False when the browser would not let us keep decisions beyond this tab. */
  readonly persistent: boolean
}
