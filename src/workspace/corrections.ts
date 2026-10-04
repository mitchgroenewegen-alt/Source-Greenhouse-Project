import type { Decision } from '../storage/types'
import type { ValueEdit } from './types'

/** The id of the value edit that goes with the correction of one cell, so reopening the cell can take it away again. */
export const correctionEditId = (cellId: string) => `corrected|${cellId}`

/** "Apply correction" also leaves a value edit behind, so the corrected number is part of the merged data. */
export function correctionEdit(decision: Decision): ValueEdit {
  return {
    id: correctionEditId(decision.cellId),
    cultivation: decision.cultivation,
    kpi: decision.kpi,
    dateFrom: decision.date,
    dateTo: decision.date,
    field: decision.field,
    newValue: decision.correctedValue as number,
    originalValue: decision.originalValue,
    createdBy: decision.decidedBy,
    createdAt: decision.decidedAt,
    reason: decision.note || `Correction after the data check (${decision.rule})`,
    source: 'corrected',
  }
}

/** The cell a correction's value edit belongs to; the reverse of correctionEditId. */
export const cellIdOfCorrection = (editId: string) => editId.slice('corrected|'.length)
