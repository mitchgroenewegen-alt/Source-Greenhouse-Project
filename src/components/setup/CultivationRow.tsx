import { Link } from 'react-router-dom'
import { formatDate } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import { fixed } from '../../lib/format'
import type { DataState } from '../../setup/dataState'
import { DATA_STATE_LABEL } from '../../setup/dataState'
import { SECONDARY_BUTTON } from '../ui/fields'

/** One cultivation under its greenhouse on the Setup screen, with what can be done to it. */
export function CultivationRow({
  cultivation,
  fruitTypeName,
  state,
  canCopyBudgets,
  canWrite,
  onEdit,
  onToggleArchive,
  onCopyBudgets,
}: {
  cultivation: Cultivation
  fruitTypeName: string | null
  state: DataState
  /** True for a cultivation added in the app, which can take budgets from another one. */
  canCopyBudgets: boolean
  canWrite: boolean
  onEdit: () => void
  onToggleArchive: () => void
  onCopyBudgets: () => void
}) {
  return (
    <li className={`flex flex-col gap-2 rounded-xl border border-line-soft bg-tile p-3 ${cultivation.archived ? 'opacity-90' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/cultivation/${cultivation.id}`} className="font-semibold text-brand hover:underline">
          {cultivation.id}
        </Link>
        <span className="flex flex-wrap gap-1.5">
          {cultivation.archived && <span className="rounded-full border border-none-line bg-none-bg px-2 py-0.5 text-xs font-semibold text-none-ink">Archived</span>}
          {state !== 'ready' && !cultivation.archived && (
            <span className="rounded-full border border-warn-line bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn-ink">{DATA_STATE_LABEL[state]}</span>
          )}
        </span>
      </div>
      <p className="num text-sm text-ink-2">
        {cultivation.variety} · {fruitTypeName ?? 'No fruit type'} · {fixed(cultivation.areaM2, 0)} m²
      </p>
      <p className="num text-xs text-ink-3">
        Planted {formatDate(cultivation.plantingDate)}
        {cultivation.plannedEndDate ? `, planned end ${formatDate(cultivation.plannedEndDate)}` : ', no planned end date'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} disabled={!canWrite} className={SECONDARY_BUTTON}>
          Edit
        </button>
        {canCopyBudgets && !cultivation.archived && (
          <button type="button" onClick={onCopyBudgets} disabled={!canWrite} className={SECONDARY_BUTTON}>
            Copy budgets from…
          </button>
        )}
        <button type="button" onClick={onToggleArchive} disabled={!canWrite} className={SECONDARY_BUTTON}>
          {cultivation.archived ? 'Restore' : 'Archive'}
        </button>
      </div>
    </li>
  )
}
