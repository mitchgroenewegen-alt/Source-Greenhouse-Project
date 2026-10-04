import type { Effects } from '../../financials'
import { moneyText, signedMoney } from '../../financials'

/** The gap in the partial margin against budget, split into what the kg did and what the energy did. They add up to the gap. */
export function EffectsList({ effects, uncompared, currency }: { effects: Effects | null; uncompared: number; currency: string }) {
  if (!effects) {
    return <p className="rounded-xl border border-line-soft bg-tile p-2 text-sm text-ink-2">No margin gap to show: it needs revenue and an energy budget for the same weeks.</p>
  }
  const rows = [
    { label: 'Volume', text: effects.volume === 0 ? 'as budgeted' : effects.volume > 0 ? 'more kg than budget' : 'fewer kg than budget', value: effects.volume },
    { label: 'Cost', text: effects.cost === 0 || effects.cost === null ? 'as budgeted' : effects.cost > 0 ? 'less energy than budget' : 'more energy than budget', value: effects.cost ?? 0 },
  ]
  return (
    <div className="rounded-xl border border-line-soft bg-tile p-2">
      <h4 className="px-0.5 text-sm font-semibold">Gap to budget in margin</h4>
      <dl className="num mt-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2 border-b border-line-soft py-1">
            <dt>
              {r.label} <span className="text-xs text-ink-3">{r.text}</span>
            </dt>
            <dd className="font-semibold">{signedMoney(r.value, currency)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-2 py-1 font-semibold">
          <dt>Total gap</dt>
          <dd>{signedMoney(effects.gap, currency)}</dd>
        </div>
      </dl>
      {uncompared > 0 && (
        <p className="px-0.5 text-xs text-ink-3">{moneyText(uncompared, currency)} of cost has no budget or target (irrigation water, and LED when it has none) and is left out of the gap.</p>
      )}
    </div>
  )
}
