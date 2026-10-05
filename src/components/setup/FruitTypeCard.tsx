import { diameterRangeText, specCheck, weightRangeText } from '../../setup/fruitTypes'
import type { FruitType } from '../../workspace/types'
import { fixed } from '../../lib/format'
import { marketPriceText } from '../../financials/priceSource'
import { SpecBadge } from '../detail/SpecBadge'
import { SECONDARY_BUTTON } from '../ui/fields'

/** One fruit type: its spec, its price, what the workbook measured for cultivations of the type, and who uses it. */
export function FruitTypeCard({
  type,
  measuredG,
  usedBy,
  canWrite,
  onEdit,
  onRemove,
}: {
  type: FruitType
  /** Average fruit weight measured in the workbook for cultivations of this type; null when there is none. */
  measuredG: number | null
  usedBy: string[]
  canWrite: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const diameter = diameterRangeText(type)
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold leading-tight">{type.name}</h2>
        {type.placeholder && <span className="rounded-full border border-none-line bg-none-bg px-2 py-0.5 text-xs font-semibold text-none-ink">Placeholder</span>}
      </header>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Tile label="Weight">{weightRangeText(type)}</Tile>
        <Tile label="Diameter">{diameter ?? 'Not entered'}</Tile>
        <Tile label="Price per kg">
          {type.pricePerKg === null ? 'Not entered' : fixed(type.pricePerKg, 2)}
          {type.pricePerKg !== null && type.priceSource && <span className="block text-xs font-normal text-ink-2">{marketPriceText(type.priceSource)}</span>}
        </Tile>
        <Tile label="Measured in the workbook">
          {measuredG === null ? (
            'No cultivation yet'
          ) : (
            <>
              {fixed(measuredG, 1)} g <SpecBadge state={specCheck(measuredG, type)} />
            </>
          )}
        </Tile>
      </dl>
      <p className="text-xs text-ink-2">{usedBy.length === 0 ? 'No cultivation uses this type.' : `Used by ${usedBy.join(', ')}.`}</p>
      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} disabled={!canWrite} className={SECONDARY_BUTTON}>
          Edit
        </button>
        <button type="button" onClick={onRemove} disabled={!canWrite} className={SECONDARY_BUTTON}>
          Remove
        </button>
      </div>
    </article>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line-soft bg-tile p-2">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="num font-semibold">{children}</dd>
    </div>
  )
}
