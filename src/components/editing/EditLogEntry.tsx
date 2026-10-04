import { kpiConfig, hasKpiConfig } from '../../config/kpis'
import { formatDateTime } from '../../lib/format'
import { formatValue } from '../../lib/kpiFormat'
import { shortWeek } from '../../data/dates'
import { weeklyChanges, weeksText, type LogEntry } from '../../editing/log'
import { fieldWord } from '../../flags'
import { SOURCE_LABEL } from './sourceLabel'
import { SECONDARY_BUTTON } from '../ui/fields'

/** "12.4 → 13.6" for one week, or for several weeks when they all go the same way; otherwise a count. */
function changeText(entry: LogEntry, hasRow: (date: string) => boolean): string {
  if (entry.kpi === null) return `${entry.edits.length} values copied`
  if (!hasKpiConfig(entry.kpi)) return `${entry.edits.length} ${entry.edits.length === 1 ? 'value' : 'values'} changed`
  const config = kpiConfig(entry.kpi)
  const changes = weeklyChanges(entry, config.aggregation, hasRow) ?? []
  if (changes.length === 0) return `${entry.edits.length} ${entry.edits.length === 1 ? 'value' : 'values'} changed`
  const text = (c: (typeof changes)[number]) => `${formatValue(config, c.before)} → ${formatValue(config, c.after)} ${config.unit}`
  if (changes.length === 1) return text(changes[0]!)
  const same = changes.every((c) => c.before === changes[0]!.before && c.after === changes[0]!.after)
  if (same) return `${text(changes[0]!)} each week`
  return `${text(changes[0]!)} in ${shortWeek(changes[0]!.week)}, and ${changes.length - 1} more ${changes.length === 2 ? 'week' : 'weeks'} (values differ)`
}

/** One line of the edit log: who, when, what changed, why, and Undo. */
export function EditLogEntry({ entry, hasRow, canWrite, onUndo }: { entry: LogEntry; hasRow: (date: string) => boolean; canWrite: boolean; onUndo: () => void }) {
  const what = entry.kpi === null ? 'Budgets, all KPIs' : `${entry.kpi}, ${entry.field === 'target' ? fieldWord('target', entry.kpi) : 'actual'}`
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
        <button type="button" onClick={onUndo} disabled={!canWrite} className={SECONDARY_BUTTON} aria-label={`Undo: ${entry.cultivation}, ${what}, ${weeksText(entry)}`}>
          Undo
        </button>
      </div>
      <p className="num text-sm">
        <span className="font-semibold">{weeksText(entry)}</span> · {changeText(entry, hasRow)}
      </p>
      <p className="text-sm text-ink-2">Reason: {entry.reason}</p>
    </li>
  )
}
