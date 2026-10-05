import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CommodityPricesCard } from '../components/financials/CommodityPricesCard'
import { RatesCard } from '../components/financials/RatesCard'
import { FruitTypeForm } from '../components/setup/FruitTypeForm'
import { WriteNotice } from '../components/setup/WriteNotice'
import { PRIMARY_BUTTON } from '../components/ui/fields'
import { ChevronLeftIcon } from '../components/ui/icons'
import { examplePricesInUse } from '../financials'
import { buildCatalog } from '../setup/catalog'
import { effectiveFruitTypes, itemsToSave } from '../setup/fruitTypes'
import { useCropData } from '../state/CropDataContext'
import { useWorkspace } from '../workspace/WorkspaceContext'
import type { FruitType } from '../workspace/types'

export default function PricesCostsScreen() {
  const { workbookCultivations, visibleCultivations, decidedBy } = useCropData()
  const { data, canWrite, save } = useWorkspace()
  const catalog = useMemo(() => buildCatalog(workbookCultivations, data), [workbookCultivations, data])
  const types = useMemo(() => [...effectiveFruitTypes(data.fruitTypes).types].sort((a, b) => a.name.localeCompare(b.name)), [data.fruitTypes])
  // Facilities that have a live cultivation, in the order the app lists them.
  const names = new Set(visibleCultivations.map((c) => c.facility))
  const facilities = catalog.facilities.filter((f) => names.has(f.name))
  const examples = examplePricesInUse(types, data.rates)
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/more" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold underline">
          <ChevronLeftIcon width={16} height={16} /> More
        </Link>
        <h1 className="text-2xl font-semibold">Prices and costs</h1>
        <p>
          What Financials multiplies the harvest and the energy and water use by. The workbook has none of these, so you enter them here. Each facility has its own heat, electricity and water rates, and can have its own price per kg for a fruit type. The price a fruit type gets everywhere else is set on{' '}
          <Link to="/fruit-types" className="font-semibold underline">Commodities (fruit types)</Link>.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setAdding(true)} disabled={!canWrite || adding} className={PRIMARY_BUTTON}>
            Add a commodity
          </button>
          <Link to="/data/import/prices" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-field px-4 text-sm font-semibold text-ink">
            Import market prices
          </Link>
        </div>
      </div>

      <WriteNotice what="change prices and costs" />
      {examples && (
        <p role="status" className="rounded-2xl border border-warn-line bg-warn-bg p-3 text-sm text-warn-ink">
          No price is entered yet, so Financials shows example prices. Enter a price below (or on Commodities), or import market prices, to replace them. After that, a commodity without a price has no revenue.
        </p>
      )}

      {adding && <FruitTypeForm others={types} disabled={!canWrite} onSave={(type: FruitType) => save('fruitTypes', itemsToSave(data.fruitTypes, type))} onCancel={() => setAdding(false)} />}

      <CommodityPricesCard types={types} examples={examples} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {facilities.map((f) => (
          <RatesCard
            key={f.id}
            facilityId={f.id}
            name={f.name}
            currency={f.currency}
            rates={data.rates.find((r) => r.facilityId === f.id)}
            fruitTypes={types}
            who={decidedBy}
            disabled={!canWrite}
            onSave={(row) => save('rates', [row])}
          />
        ))}
      </div>
    </div>
  )
}
