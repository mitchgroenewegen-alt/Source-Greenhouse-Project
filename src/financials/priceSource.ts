// How a price that came from a market price file is described next to the price.

import { formatDate } from '../data/dates'
import type { PriceSourceNote } from '../workspace/types'

/** "Market price as of 4 Oct 2026": short, for beside a price. */
export const marketPriceText = (note: PriceSourceNote): string => `Market price as of ${formatDate(note.date)}`

/** "Market price, 4 Oct 2026, imported by dana@example.com": the full note. */
export const marketPriceLongText = (note: PriceSourceNote): string =>
  `Market price, ${formatDate(note.date)}${note.importedBy ? `, imported by ${note.importedBy}` : ''}`
