import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FruitTypeCard } from '../components/setup/FruitTypeCard'
import { FruitTypeForm } from '../components/setup/FruitTypeForm'
import { WriteNotice } from '../components/setup/WriteNotice'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui/fields'
import { ChevronLeftIcon } from '../components/ui/icons'
import { cultivationsUsing, DEFAULT_FRUIT_TYPES, effectiveFruitTypes, itemsToSave, measuredFruitWeight, removalBlock } from '../setup/fruitTypes'
import { useCropData } from '../state/CropDataContext'
import { useWorkspace } from '../workspace/WorkspaceContext'
import type { FruitType } from '../workspace/types'

export default function FruitTypesScreen() {
  const { cultivations, weeks, point } = useCropData()
  const { data, canWrite, save, remove } = useWorkspace()
  const { types, seeded } = effectiveFruitTypes(data.fruitTypes)
  const [editing, setEditing] = useState<FruitType | 'new' | null>(null)
  const [removing, setRemoving] = useState<FruitType | null>(null)

  const sorted = useMemo(() => [...types].sort((a, b) => a.weightMinG - b.weightMinG || a.name.localeCompare(b.name)), [types])
  const weekIds = useMemo(() => weeks.map((w) => w.id), [weeks])
  const cards = useMemo(
    () =>
      sorted.map((type) => {
        const using = cultivationsUsing(type.id, cultivations)
        return { type, using, measuredG: measuredFruitWeight(using.map((c) => c.id), weekIds, (id, week) => point(id, 'Fruit weight', week)?.actual) }
      }),
    [sorted, cultivations, weekIds, point],
  )

  const saveType = (type: FruitType) => save('fruitTypes', itemsToSave(data.fruitTypes, type))

  async function confirmRemove(type: FruitType) {
    // While the defaults are showing, "removing" one saves the other eight, which makes them the workspace's own.
    const done = seeded ? await remove('fruitTypes', [type.id]) : await save('fruitTypes', DEFAULT_FRUIT_TYPES.filter((d) => d.id !== type.id))
    if (done) setRemoving(null)
  }

  const blocked = removing ? removalBlock(removing, cultivations) : null
  const last = types.length <= 1

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/more" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold underline">
          <ChevronLeftIcon width={16} height={16} /> More
        </Link>
        <h1 className="text-2xl font-semibold">Fruit types and specs</h1>
        <p>
          The weight range each fruit type should have. Next to it, the average fruit weight the workbook measured for the cultivations of that type, as a sanity check. The price per kg is used later in Financials.
        </p>
      </div>

      <WriteNotice what="change fruit types" />
      {!seeded && (
        <p className="rounded-2xl border border-line bg-card p-3 text-sm">
          These are starting values, all placeholders. The first change you save keeps all of them, so you can edit them one by one.
        </p>
      )}

      {editing && (
        <FruitTypeForm
          key={editing === 'new' ? 'new' : editing.id}
          type={editing === 'new' ? undefined : editing}
          others={types.filter((t) => editing === 'new' || t.id !== editing.id)}
          disabled={!canWrite}
          onSave={saveType}
          onCancel={() => setEditing(null)}
        />
      )}

      {removing && (
        <div role="alertdialog" aria-label={`Remove ${removing.name}`} className="flex flex-col gap-2 rounded-2xl border border-warn-line bg-warn-bg p-4 text-warn-ink">
          <p className="font-semibold">
            {blocked ?? (last ? 'You need at least one fruit type, so this one stays.' : `Remove ${removing.name}? This cannot be undone.`)}
          </p>
          <div className="flex flex-wrap gap-2">
            {!blocked && !last && (
              <button type="button" onClick={() => void confirmRemove(removing)} disabled={!canWrite} className={PRIMARY_BUTTON}>
                Remove {removing.name}
              </button>
            )}
            <button type="button" onClick={() => setRemoving(null)} className={SECONDARY_BUTTON}>
              {blocked || last ? 'Close' : 'Keep it'}
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <div>
          <button type="button" onClick={() => setEditing('new')} disabled={!canWrite} className={PRIMARY_BUTTON}>
            Add a fruit type
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ type, using, measuredG }) => (
          <FruitTypeCard
            key={type.id}
            type={type}
            measuredG={measuredG}
            usedBy={using.map((c) => c.id)}
            canWrite={canWrite}
            onEdit={() => {
              setRemoving(null)
              setEditing(type)
            }}
            onRemove={() => {
              setEditing(null)
              setRemoving(type)
            }}
          />
        ))}
      </div>
    </div>
  )
}
