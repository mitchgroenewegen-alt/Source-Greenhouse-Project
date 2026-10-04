// The export: everything in the app as one workbook, with the edits and entries applied. Each sheet is made by one function
// that takes the same input; to add a sheet, write a function like those below and put it in EXPORT_SHEETS.
//
// The KPIs sheet keeps the workbook's own columns (Date ... Target), so the file can be imported again as it is, and adds
// three columns at the end: the workbook's original values and where each row's values came from.

import { kpiConfig, hasKpiConfig, planWord } from '../config/kpis'
import { addDays, cropWeekOn, formatDate } from '../data/dates'
import type { Cultivation, DailyRow, DataFile } from '../data/types'
import { logItems } from '../editing/log'
import { fieldWord, ruleTitleFor, type Flag } from '../flags'
import { formatDateTime } from '../lib/format'
import type { WeeklyPoint } from '../scoring/effective'
import { scoreWith, STATUS_LABEL } from '../scoring/score'
import { effectiveFruitTypes, fruitTypeIdOf } from '../setup/fruitTypes'
import { DECISION_LABEL, type Decision } from '../storage/types'
import type { WorkspaceData } from '../workspace/types'
import { SOURCE_LABEL } from '../components/editing/sourceLabel'
import { numberCell, yesNo, type Cell, type SheetSpec } from './sheets'

/** The workbook names its company on every row; the app has no company of its own, so the export repeats it. */
export const COMPANY = 'Perfect Produce'

/** Where a row's values come from. Anything that changed a value after the workbook is named; the latest change wins. */
export type RowSource = 'workbook' | 'entered' | 'imported' | 'edited' | 'corrected'

export interface ExportInput {
  now: Date
  /** Who exports: the signed-in email, or the name typed in. */
  who: string
  /** The workbook as it was read. */
  workbook: DataFile
  /** The workbook with the workspace laid over it: what the screens show. */
  merged: DataFile
  workspace: WorkspaceData
  /** Every flag of the data checks (see CropData.flags). */
  flags: Flag[]
  decisions: Decision[]
  /** The weekly value in use (flagged values left out until decided): what the scores are made from. */
  point: (cultivation: string, kpi: string, week: string) => WeeklyPoint | undefined
}

export type SheetBuilder = (input: ExportInput) => SheetSpec

const cellKey = (cultivation: string, kpi: string, date: string) => `${cultivation}|${kpi}|${date}`
const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** crop-performance-2025-09-03.xlsx, or crop-performance-scorecard-2025-W34.xlsx when a `part` is given. */
export function exportFileName(now: Date, part?: string): string {
  return part ? `crop-performance-${part}.xlsx` : `crop-performance-${isoDay(now)}.xlsx`
}

/** The source of every row of the merged data: the workbook, or what last changed it. */
export function rowSources(input: Pick<ExportInput, 'workbook' | 'merged' | 'workspace'>): Map<string, RowSource> {
  const sources = new Map<string, RowSource>()
  const inBase = new Set(input.workbook.daily.map((r) => cellKey(r.cultivation, r.kpi, r.date)))
  const present = new Set(input.merged.daily.map((r) => cellKey(r.cultivation, r.kpi, r.date)))
  for (const r of input.workspace.enteredRows) {
    const key = cellKey(r.cultivation, r.kpi, r.date)
    if (present.has(key)) sources.set(key, r.source === 'imported' ? 'imported' : 'entered')
  }
  // Value edits are laid over the rows, oldest first (see merge), so the newest one names the source.
  const edits = [...input.workspace.valueEdits].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const edit of edits) {
    for (let i = 0, date = edit.dateFrom; date <= edit.dateTo && i < 3660; i++, date = addDays(date, 1)) {
      const key = cellKey(edit.cultivation, edit.kpi, date)
      if (present.has(key)) sources.set(key, edit.source === 'corrected' ? 'corrected' : 'edited')
    }
  }
  for (const key of present) if (!sources.has(key)) sources.set(key, inBase.has(key) ? 'workbook' : 'edited')
  return sources
}

// ---- The sheets ----

const readMeSheet: SheetBuilder = (input) => {
  const { merged, workspace } = input
  const imported = workspace.enteredRows.filter((r) => r.source === 'imported').length
  const entered = workspace.enteredRows.length - imported
  const first = merged.weeks[0]
  const last = merged.weeks[merged.weeks.length - 1]
  const rows: Cell[][] = [
    [`${COMPANY}: growing data, exported from Crop Performance`],
    [`Exported ${formatDateTime(input.now.toISOString())} by ${input.who || 'unknown'}.`],
    [`Period: ${formatDate(merged.meta.periodStart)} to ${formatDate(merged.meta.periodEnd)}${first && last ? ` (ISO weeks ${first.id} to ${last.id})` : ''}. ${merged.meta.cultivationCount} cultivations.`],
    [`Applied on top of the workbook: ${workspace.valueEdits.length} value edits (edited budgets and targets, corrections, copied budgets) and ${workspace.enteredRows.length} days typed in or imported (${entered} entered, ${imported} imported).`],
    [],
    ['Sheets'],
    ['Greenhouses', 'One row per cultivation, new ones included: the workbook columns, plus fruit type, planned end date and whether it is archived.'],
    ['KPIs', 'One row per cultivation, date and KPI, with the values in use (edits and entries applied). Original actual and Original target are what the workbook had; Source says where the row now comes from: workbook, entered, imported, edited or corrected. This sheet can be imported again.'],
    ['Weekly scores', 'One row per cultivation, week and KPI: the weekly actual, the budget or target, the variance and the status, as the app scores them (flagged values waiting for a decision are left out).'],
    ['Data checks', 'Every value the data checks flag, with the decision made about it, if any.'],
    ['Edit log', 'Every edit and every entry or import, newest first: who, when, what and why.'],
    ['Settings', 'Fruit types and their specs.'],
    [],
    ['Notes'],
    ['•  An empty cell means nothing was recorded.'],
    ['•  Budget applies to Production, Heating energy and LED lighting; target to the other KPIs. Both are the Target column of the KPIs sheet.'],
    [],
    ['KPI dictionary'],
    ['KPI', 'Category', 'Unit', 'Definition', 'How it adds up over time'],
    ...merged.kpis.map((k): Cell[] => [k.name, k.category, k.unit, k.definition, k.aggregationText]),
  ]
  return { name: 'Read me', rows, widths: [34, 16, 14, 60, 28] }
}

const cropWeekHeader = (merged: DataFile) => `Crop week on ${formatDate(merged.meta.periodEnd)}`

const greenhousesSheet: SheetBuilder = ({ merged, workspace }) => {
  const types = new Map(effectiveFruitTypes(workspace.fruitTypes).types.map((t) => [t.id, t]))
  const fruitName = (c: Cultivation) => {
    const id = fruitTypeIdOf(c)
    return id === null ? null : (types.get(id)?.name ?? id)
  }
  const rows: Cell[][] = [
    ['Company', 'Facility', 'Greenhouse', 'Cultivation', 'Crop', 'Variety', 'Planting date', 'Growing area (m²)', cropWeekHeader(merged), 'Fruit type', 'Planned end date', 'Archived'],
    ...merged.cultivations.map((c): Cell[] => [
      COMPANY,
      c.facility,
      c.greenhouse,
      c.id,
      c.crop,
      c.variety,
      { date: c.plantingDate },
      c.areaM2,
      cropWeekOn(c.plantingDate, merged.meta.periodEnd),
      fruitName(c),
      c.plannedEndDate ? { date: c.plannedEndDate } : null,
      yesNo(c.archived === true),
    ]),
  ]
  return { name: 'Greenhouses', rows, widths: [16, 14, 12, 14, 8, 12, 13, 17, 20, 16, 16, 9] }
}

const kpisSheet: SheetBuilder = (input) => {
  const { merged, workbook } = input
  const cultivations = new Map(merged.cultivations.map((c) => [c.id, c]))
  const dictionary = new Map(merged.kpis.map((k) => [k.name, k]))
  const original = new Map(workbook.daily.map((r) => [cellKey(r.cultivation, r.kpi, r.date), r]))
  const sources = rowSources(input)
  const rows: Cell[][] = [
    ['Date', 'ISO week', 'Company', 'Facility', 'Greenhouse', 'Cultivation', 'Crop', 'Variety', 'KPI category', 'KPI', 'Unit', 'Actual', 'Target', 'Original actual', 'Original target', 'Source'],
  ]
  for (const r of merged.daily) {
    const c = cultivations.get(r.cultivation)!
    const k = dictionary.get(r.kpi)!
    const key = cellKey(r.cultivation, r.kpi, r.date)
    const was: DailyRow | undefined = original.get(key)
    rows.push([{ date: r.date }, r.week, COMPANY, c.facility, c.greenhouse, c.id, c.crop, c.variety, k.category, k.name, k.unit, r.actual, r.target, was?.actual ?? null, was?.target ?? null, sources.get(key) ?? 'workbook'])
  }
  return { name: 'KPIs', rows, widths: [12, 10, 16, 14, 12, 14, 8, 12, 15, 32, 14, 10, 10, 14, 14, 11] }
}

const weeklyScoresSheet: SheetBuilder = ({ merged, point }) => {
  const rows: Cell[][] = [['Cultivation', 'Week', 'KPI', 'Unit', 'Actual', 'Budget / target', 'Plan value is a', 'Variance', 'Variance in', 'Status', 'Days', 'Open data checks']]
  for (const w of merged.weekly) {
    if (!hasKpiConfig(w.kpi)) continue
    const config = kpiConfig(w.kpi)
    const p = point(w.cultivation, w.kpi, w.week)
    if (!p) continue
    const score = scoreWith(config, p.paired ? p.actual : null, p.paired ? p.target : null)
    rows.push([
      w.cultivation,
      w.week,
      w.kpi,
      config.unit,
      p.actual,
      p.target,
      planWord(config),
      numberCell(score.variance),
      score.variance === null ? null : config.variance === 'percent' ? '%' : config.unit,
      score.status ? STATUS_LABEL[score.status] : 'Not scored',
      p.days,
      p.openFlags,
    ])
  }
  return { name: 'Weekly scores', rows, widths: [14, 10, 32, 14, 10, 14, 15, 10, 12, 11, 7, 16] }
}

const dataChecksSheet: SheetBuilder = ({ flags, decisions }) => {
  const decisionOf = new Map(decisions.map((d) => [d.cellId, d]))
  const rows: Cell[][] = [
    ['Cultivation', 'KPI', 'Date', 'Column', 'Value', 'Rule', 'Explanation', 'Suggested value', 'Decision', 'Corrected value', 'Decided by', 'Decided at', 'Note'],
  ]
  for (const f of flags) {
    const d = decisionOf.get(f.id)
    rows.push([
      f.cultivation,
      f.kpi,
      { date: f.date },
      fieldWord(f.field, f.kpi, { capitalised: true }),
      f.value,
      ruleTitleFor(f.rule, f.kpi),
      f.explanation,
      f.suggestion,
      d ? DECISION_LABEL[d.kind] : 'Waiting for a decision',
      d?.correctedValue ?? null,
      d?.decidedBy ?? null,
      d ? formatDateTime(d.decidedAt) : null,
      d?.note || null,
    ])
  }
  return { name: 'Data checks', rows, widths: [14, 32, 12, 9, 10, 28, 60, 14, 22, 14, 22, 20, 30] }
}

const editLogSheet: SheetBuilder = ({ workspace }) => {
  const rows: Cell[][] = [['When', 'Who', 'What', 'Cultivation', 'KPI', 'Column', 'From', 'To', 'Values', 'Reason']]
  for (const item of logItems(workspace.valueEdits, workspace.enteredRows)) {
    if (item.type === 'edit') {
      const e = item.entry
      rows.push([
        formatDateTime(e.createdAt),
        e.createdBy,
        SOURCE_LABEL[e.source],
        e.cultivation,
        e.kpi ?? 'All KPIs (budgets copied)',
        e.kpi === null ? null : e.field === 'target' ? fieldWord('target', e.kpi, { capitalised: true }) : 'Actual',
        { date: e.dateFrom },
        { date: e.dateTo },
        e.edits.length,
        e.reason,
      ])
    } else {
      const e = item.entry
      rows.push([formatDateTime(e.createdAt), e.createdBy, SOURCE_LABEL[e.source], e.cultivation, e.kpis.length === 1 ? e.kpis[0]! : `${e.kpis.length} KPIs`, 'Actual and budget / target', { date: e.dateFrom }, { date: e.dateTo }, e.rows.length, null])
    }
  }
  return { name: 'Edit log', rows, widths: [20, 26, 28, 14, 32, 24, 12, 12, 8, 40] }
}

const settingsSheet: SheetBuilder = ({ workspace }) => {
  const { types } = effectiveFruitTypes(workspace.fruitTypes)
  const rows: Cell[][] = [
    ['Fruit types and specs'],
    ['Id', 'Name', 'Weight from (g)', 'Weight to (g)', 'Diameter from (mm)', 'Diameter to (mm)', 'Price per kg', 'Placeholder numbers'],
    ...types.map((t): Cell[] => [t.id, t.name, t.weightMinG, t.weightMaxG, t.diameterMinMm, t.diameterMaxMm, t.pricePerKg, yesNo(t.placeholder)]),
  ]
  return { name: 'Settings', rows, widths: [20, 20, 15, 14, 18, 16, 13, 19] }
}

/** The sheets of the export, in order. Forecast and Financials join here in later steps. */
export const EXPORT_SHEETS: SheetBuilder[] = [readMeSheet, greenhousesSheet, kpisSheet, weeklyScoresSheet, dataChecksSheet, editLogSheet, settingsSheet]

export const buildExport = (input: ExportInput): SheetSpec[] => EXPORT_SHEETS.map((build) => build(input))
