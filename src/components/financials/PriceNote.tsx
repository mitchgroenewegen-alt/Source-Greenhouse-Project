import { Link } from 'react-router-dom'
import type { CultivationFinancials } from '../../financials'
import { fixed } from '../../lib/format'

/** Which price per kg the cultivation's revenue uses, and where it comes from. */
export function PriceNote({ f }: { f: CultivationFinancials }) {
  const { price, currency } = f
  if (price.value === null) {
    return (
      <p className="text-xs font-semibold text-warn-ink">
        No price for {price.fruitTypeName ?? 'this cultivation'}, so no revenue. <Link to="/prices" className="underline">Enter one</Link>.
      </p>
    )
  }
  const where = price.source === 'facility' ? `${f.cultivation.facility}'s own price` : price.source === 'example' ? 'example price' : `${price.fruitTypeName ?? 'fruit type'} price`
  return (
    <p className="num text-xs text-ink-3">
      Price {fixed(price.value, 2)} {currency}/kg ({where})
      {f.led.placeholder && ` · LED ${f.led.wattsPerM2} W/m² (placeholder)`}
    </p>
  )
}
