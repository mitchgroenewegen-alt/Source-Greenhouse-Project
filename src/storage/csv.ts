// CSV export and import of verification decisions.

import type { RuleId } from '../flags'
import { RULE_ORDER } from '../flags'
import type { Decision, DecisionKind } from './types'

export const CSV_COLUMNS = [
  'cultivation',
  'kpi',
  'date',
  'field',
  'rule',
  'original_value',
  'decision',
  'corrected_value',
  'decided_by',
  'decided_at',
  'note',
] as const

/** Free text that starts with one of these would be run as a formula by a spreadsheet. */
const FORMULA_START = /^[=+\-@\t\r]/

function guardFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text
}

function unguardFormula(text: string): string {
  return text.startsWith("'") && FORMULA_START.test(text.slice(1)) ? text.slice(1) : text
}

function quote(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function numberText(value: number | null): string {
  return value === null ? '' : String(value)
}

export function decisionsToCsv(decisions: Decision[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const d of decisions) {
    lines.push(
      [
        d.cultivation,
        d.kpi,
        d.date,
        d.field,
        d.rule,
        numberText(d.originalValue),
        d.kind,
        numberText(d.correctedValue),
        guardFormula(d.decidedBy),
        d.decidedAt,
        guardFormula(d.note),
      ]
        .map(quote)
        .join(','),
    )
  }
  return lines.join('\r\n') + '\r\n'
}

/** Split CSV text into rows of fields, handling quotes, doubled quotes, and CR, LF or CRLF line ends. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

export interface CsvImport {
  decisions: Decision[]
  /** One message per row that could not be read. */
  errors: string[]
}

const KINDS: DecisionKind[] = ['confirm', 'correct', 'exclude']

function parseNumber(text: string): number | null | undefined {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : undefined
}

export function parseDecisionsCsv(text: string): CsvImport {
  const rows = parseCsvRows(text)
  const errors: string[] = []
  if (rows.length === 0) return { decisions: [], errors: ['The file is empty.'] }
  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) return { decisions: [], errors: [`Missing column(s): ${missing.join(', ')}.`] }
  const at = (row: string[], name: (typeof CSV_COLUMNS)[number]) => row[header.indexOf(name)] ?? ''

  const decisions: Decision[] = []
  rows.slice(1).forEach((row, i) => {
    const where = `Row ${i + 2}`
    const cultivation = at(row, 'cultivation').trim()
    const kpi = at(row, 'kpi').trim()
    const date = at(row, 'date').trim()
    const field = at(row, 'field').trim()
    const rule = at(row, 'rule').trim() as RuleId
    const kind = at(row, 'decision').trim() as DecisionKind
    const original = parseNumber(at(row, 'original_value'))
    const corrected = parseNumber(at(row, 'corrected_value'))
    if (!cultivation || !kpi) return errors.push(`${where}: cultivation and kpi are required.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errors.push(`${where}: "${date}" is not a date like 2025-08-24.`)
    if (field !== 'actual' && field !== 'target') return errors.push(`${where}: field must be actual or target.`)
    if (!RULE_ORDER.includes(rule)) return errors.push(`${where}: unknown rule "${rule}".`)
    if (!KINDS.includes(kind)) return errors.push(`${where}: decision must be confirm, correct or exclude.`)
    if (original === undefined) return errors.push(`${where}: original_value is not a number.`)
    if (corrected === undefined) return errors.push(`${where}: corrected_value is not a number.`)
    if (kind === 'correct' && corrected === null) return errors.push(`${where}: a correction needs a corrected_value.`)
    decisions.push({
      cellId: `${cultivation}|${kpi}|${date}|${field}`,
      cultivation,
      kpi,
      date,
      field,
      rule,
      originalValue: original,
      kind,
      correctedValue: kind === 'correct' ? corrected : null,
      decidedBy: unguardFormula(at(row, 'decided_by')),
      decidedAt: at(row, 'decided_at').trim() || new Date(0).toISOString(),
      note: unguardFormula(at(row, 'note')),
    })
  })
  return { decisions, errors }
}

export interface MergeResult {
  merged: Decision[]
  added: number
  updated: number
  /** Imported decisions that were older than the one already stored, so the stored one stayed. */
  keptExisting: number
}

/** Combine imported decisions with the stored ones. For the same cell the later decision wins; a tie goes to the import. */
export function mergeDecisions(existing: Decision[], imported: Decision[]): MergeResult {
  const byCell = new Map(existing.map((d) => [d.cellId, d]))
  let added = 0
  let updated = 0
  let keptExisting = 0
  for (const incoming of imported) {
    const current = byCell.get(incoming.cellId)
    if (!current) {
      byCell.set(incoming.cellId, incoming)
      added++
    } else if (incoming.decidedAt >= current.decidedAt) {
      byCell.set(incoming.cellId, incoming)
      updated++
    } else keptExisting++
  }
  return { merged: [...byCell.values()], added, updated, keptExisting }
}
