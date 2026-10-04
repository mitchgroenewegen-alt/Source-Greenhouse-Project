import { useMemo, useState } from 'react'
import type { Cultivation, DailyRow } from '../../data/types'
import { formatDate } from '../../data/dates'
import { budgetCopyEdits, copySources } from '../../setup/copyBudgets'
import { fruitTypeIdOf } from '../../setup/fruitTypes'
import type { FruitType, ValueEdit } from '../../workspace/types'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SelectField } from '../ui/fields'

/** "Copy budgets from...": pick a cultivation of the same fruit type; its targets are lined up by crop day and copied as value edits. */
export function CopyBudgetsPanel({
  target,
  cultivations,
  daily,
  fruitTypes,
  createdBy,
  disabled,
  onSave,
  onCancel,
}: {
  target: Cultivation
  cultivations: Cultivation[]
  /** The merged daily rows. */
  daily: DailyRow[]
  fruitTypes: FruitType[]
  createdBy: string
  disabled: boolean
  onSave: (edits: ValueEdit[]) => Promise<boolean>
  onCancel: () => void
}) {
  const withTargets = useMemo(() => new Set(daily.filter((r) => r.target !== null).map((r) => r.cultivation)), [daily])
  const sources = useMemo(() => copySources(target, cultivations, withTargets), [target, cultivations, withTargets])
  const [sourceId, setSourceId] = useState('')
  const [saving, setSaving] = useState(false)
  const typeName = fruitTypes.find((t) => t.id === fruitTypeIdOf(target))?.name ?? 'this fruit type'

  const source = sources.find((c) => c.id === sourceId)
  const edits = useMemo(
    () => (source ? budgetCopyEdits({ source, target, daily, createdBy, createdAt: new Date().toISOString() }) : []),
    [source, target, daily, createdBy],
  )
  const days = new Set(edits.map((e) => e.dateFrom))
  const first = edits.length > 0 ? [...days].sort()[0]! : null
  const last = edits.length > 0 ? [...days].sort().at(-1)! : null
  const alreadyHas = withTargets.has(target.id)

  async function copy() {
    setSaving(true)
    const saved = await onSave(edits)
    setSaving(false)
    if (saved) onCancel()
  }

  return (
    <section aria-label={`Copy budgets to ${target.id}`} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Copy budgets to {target.id}</h2>
      {sources.length === 0 ? (
        <p className="text-sm">No other {typeName} cultivation has budgets to copy yet.</p>
      ) : (
        <>
          <p className="text-sm">
            Copies the targets of a {typeName} cultivation by crop day: the budget on its crop day N becomes the budget of {target.id} on its crop day N (days since planting). Planted {formatDate(target.plantingDate)}, so crop day 0 is {formatDate(target.plantingDate)}.
          </p>
          <SelectField label="Copy from" value={sourceId} onChange={setSourceId} options={sources.map((c) => ({ value: c.id, label: `${c.id}, planted ${formatDate(c.plantingDate)}` }))} placeholder="Choose a cultivation" />
          {source && (
            <p className="rounded-xl border border-line-soft bg-tile p-2.5 text-sm" role="status">
              {edits.length === 0
                ? `${source.id} has no targets to copy.`
                : `${edits.length} values on ${days.size} days will be copied, from ${formatDate(first!)} to ${formatDate(last!)}. They are saved as edits with the reason "Copied from ${source.id}", so the workbook is not changed.`}
              {alreadyHas && ' This cultivation already has budgets; copied days replace the ones on the same dates.'}
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {sources.length > 0 && (
          <button type="button" onClick={() => void copy()} disabled={disabled || saving || edits.length === 0} className={PRIMARY_BUTTON}>
            {saving ? 'Copying…' : 'Copy budgets'}
          </button>
        )}
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
          {sources.length > 0 ? 'Cancel' : 'Close'}
        </button>
      </div>
    </section>
  )
}
