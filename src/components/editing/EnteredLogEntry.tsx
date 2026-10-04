import { hasKpiConfig, kpiConfig, planWord } from '../../config/kpis'
import { formatDate } from '../../data/dates'
import { formatDateTime } from '../../lib/format'
import { formatValue } from '../../lib/kpiFormat'
import type { EntryLogEntry } from '../../editing/log'
import type { EnteredRow } from '../../workspace/types'
import { SECONDARY_BUTTON } from '../ui/fields'
import { SOURCE_LABEL } from './sourceLabel'

/** At most this many days are listed one by one; more are summed up as a count and a range. */
const LISTED = 3

/** "18 Aug 2025: actual 0.50, budget 0.63 kg/m²" */
function rowText(row: EnteredRow, withKpi: boolean): string {
  const config = hasKpiConfig(row.kpi) ? kpiConfig(row.kpi) : null
  const show = (value: number | null) => (config ? formatValue(config, value) : String(value))
  const parts = [row.actual !== null ? `actual ${show(row.actual)}` : null, row.target !== null ? `${config ? planWord(config) : 'target'} ${show(row.target)}` : null].filter(Boolean)
  return `${formatDate(row.date)}: ${withKpi ? `${row.kpi}, ` : ''}${parts.join(', ') || 'no values'}${config ? ` ${config.unit}` : ''}`
}

/** One line of the edit log for days that were typed in or imported: who, when, what, and Undo. */
export function EnteredLogEntry({ entry, canWrite, onUndo }: { entry: EntryLogEntry; canWrite: boolean; onUndo: () => void }) {
  const what = entry.kpis.length === 1 ? entry.kpis[0]! : `${entry.kpis.length} KPIs`
  const count = `${entry.rows.length} ${entry.rows.length === 1 ? 'value' : 'values'}`
  const verb = entry.source === 'imported' ? 'imported' : 'entered'
  return (
    <li className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">
            {entry.cultivation} · {what}
          </h3>
          <p className="text-xs text-ink-3">
            {entry.createdBy} · {formatDateTime(entry.createdAt)} · {SOURCE_LABEL[entry.source]}
          </p>
        </div>
        <button type="button" onClick={onUndo} disabled={!canWrite} className={SECONDARY_BUTTON} aria-label={`Undo: ${entry.cultivation}, ${what}, ${count} ${verb}`}>
          Undo
        </button>
      </div>
      {entry.rows.length <= LISTED ? (
        <ul className="num text-sm">
          {entry.rows.map((row) => (
            <li key={`${row.kpi}|${row.date}`}>{rowText(row, entry.kpis.length > 1)}</li>
          ))}
        </ul>
      ) : (
        <p className="num text-sm">
          {count} {verb}, {formatDate(entry.dateFrom)}
          {entry.dateTo !== entry.dateFrom && ` to ${formatDate(entry.dateTo)}`}
        </p>
      )}
      <p className="text-sm text-ink-2">Undo takes {entry.rows.length === 1 ? 'it' : 'them'} away; the workbook&apos;s own values, if there were any, come back.</p>
    </li>
  )
}
