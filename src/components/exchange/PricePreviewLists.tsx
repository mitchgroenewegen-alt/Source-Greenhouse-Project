import { fixed } from '../../lib/format'
import { changePercent, changeText, type PriceChange, type UnknownCommodity } from '../../exchange/pricePreview'
import { CheckField } from '../ui/fields'
import { LISTED } from './ImportPreviewLists'

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-line-soft bg-tile p-3">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-ink-2">({count})</span>
      </h3>
      {children}
    </section>
  )
}

/** The prices the file would set: commodity, where, and old → new with the change in percent. */
export function PriceChangeList({ changes }: { changes: PriceChange[] }) {
  return (
    <Section title="Prices that change" count={changes.length}>
      <ul className="num flex flex-col gap-1 text-sm">
        {changes.slice(0, LISTED * 3).map((c) => (
          <li key={c.row.line} className="break-words">
            <span className="font-semibold">{c.typeName}</span>
            {c.newCommodity && <span className="ml-1 rounded-full bg-field px-1.5 text-xs font-semibold">new commodity</span>}
            {' · '}
            {c.facilityName ? `${c.facilityName} price` : 'all facilities'}: {changeText(c.before, c.after)} per kg
            {c.row.unit === 'lb' && <span className="text-ink-2"> (from {fixed(c.row.price, 2)} per lb)</span>}
          </li>
        ))}
      </ul>
      {changes.length > LISTED * 3 && <p className="text-xs text-ink-2">and {changes.length - LISTED * 3} more.</p>}
    </Section>
  )
}

/** Commodities in the file that the app does not have: tick one to create it as a new commodity in the same import. */
export function UnknownCommodityList({ unknown, onToggle, disabled }: { unknown: UnknownCommodity[]; onToggle: (key: string, create: boolean) => void; disabled: boolean }) {
  return (
    <Section title="Commodities the app does not know" count={unknown.length}>
      <p className="text-xs text-ink-2">Rows of a commodity that is not ticked are left out. A new commodity gets a placeholder weight range (1–500 g) until you enter its real specs on Commodities (fruit types).</p>
      <ul className="flex flex-col gap-1">
        {unknown.map((u) => (
          <li key={u.key}>
            <CheckField
              label={`Create “${u.name}” as a new commodity`}
              checked={u.create}
              onChange={(checked) => onToggle(u.key, checked)}
              hint={`Row ${u.lines.join(', ')}. ${disabled ? 'Sign in to create it.' : u.create ? 'It is created and priced when you apply.' : 'Not created: its rows are left out.'}`}
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** "up 12.0%" style summary of the biggest move, to catch a typo like 28 for 2.8. */
export function biggestMove(changes: PriceChange[]): string | null {
  let best: { name: string; pct: number } | null = null
  for (const c of changes) {
    const pct = changePercent(c.before, c.after)
    if (pct !== null && (best === null || Math.abs(pct) > Math.abs(best.pct))) best = { name: c.typeName, pct }
  }
  return best && Math.abs(best.pct) >= 50 ? `${best.name} moves ${best.pct > 0 ? 'up' : 'down'} ${fixed(Math.abs(best.pct), 0)}%. Check the file if that is not what you expect.` : null
}
