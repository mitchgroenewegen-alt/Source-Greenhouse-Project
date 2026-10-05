import { marketPriceText } from '../../financials/priceSource'
import { fixed } from '../../lib/format'
import type { FruitType } from '../../workspace/types'

/** The general price per kg of each commodity (fruit type), with where an imported one came from. A facility's own price is on its card below. */
export function CommodityPricesCard({ types, examples }: { types: FruitType[]; examples: boolean }) {
  return (
    <section aria-label="Commodity prices" className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Price per kg of each commodity</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <li key={t.id} className="min-w-0 rounded-xl border border-line-soft bg-tile p-2 text-sm">
            <span className="block text-xs text-ink-2">{t.name}</span>
            <span className="num block font-semibold">{t.pricePerKg === null ? (examples ? 'Example price' : 'No price') : fixed(t.pricePerKg, 2)}</span>
            {t.pricePerKg !== null && <span className="block text-xs text-ink-2">{t.priceSource ? marketPriceText(t.priceSource) : 'Entered by hand'}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
