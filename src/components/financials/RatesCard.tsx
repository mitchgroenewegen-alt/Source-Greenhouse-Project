import { useState } from 'react'
import { rateInputsOf, ratesRowFor, validateRates, type RatesInput } from '../../financials'
import { EXAMPLE_RATES } from '../../financials/defaults'
import { marketPriceText } from '../../financials/priceSource'
import { formatDateTime } from '../../lib/format'
import type { FruitType, Rates } from '../../workspace/types'
import { PRIMARY_BUTTON, TextField } from '../ui/fields'

/**
 * One facility's rates: heat and electricity per kWh, water per m³, and the price per kg for each fruit type where this facility's differs
 * from the fruit type's own. Empty means "not entered": an energy or water rate then falls back to the example, and a price to the fruit type's.
 */
export function RatesCard({
  facilityId,
  name,
  currency,
  rates,
  fruitTypes,
  who,
  disabled,
  onSave,
}: {
  facilityId: string
  name: string
  currency: string
  rates: Rates | undefined
  fruitTypes: FruitType[]
  who: string
  disabled: boolean
  onSave: (row: Rates) => Promise<boolean>
}) {
  const [input, setInput] = useState<RatesInput>(() => rateInputsOf(rates))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (field: 'heatPerKwh' | 'electricityPerKwh' | 'waterPerM3') => (value: string) => {
    setSaved(false)
    setInput((prev) => ({ ...prev, [field]: value }))
  }
  const setPrice = (id: string) => (value: string) => {
    setSaved(false)
    setInput((prev) => ({ ...prev, prices: { ...prev.prices, [id]: value } }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = validateRates(input)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    const ok = await onSave(ratesRowFor(facilityId, input, who, new Date(), rates))
    setSaving(false)
    setSaved(ok)
  }

  const heading = `${facilityId}-rates`

  return (
    <form onSubmit={submit} noValidate aria-labelledby={heading} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div>
        <h2 id={heading} className="text-lg font-semibold">{name}</h2>
        <p className="text-xs text-ink-2">Amounts in {currency}. Leave a rate empty to use the example ({EXAMPLE_RATES.heatPerKwh} heat, {EXAMPLE_RATES.electricityPerKwh} electricity, {EXAMPLE_RATES.waterPerM3} water).</p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        <TextField label="Heat per kWh" value={input.heatPerKwh} onChange={set('heatPerKwh')} error={errors.heatPerKwh} inputMode="decimal" disabled={disabled} />
        <TextField label="Electricity per kWh" value={input.electricityPerKwh} onChange={set('electricityPerKwh')} error={errors.electricityPerKwh} inputMode="decimal" disabled={disabled} />
        <TextField label="Water per m³" value={input.waterPerM3} onChange={set('waterPerM3')} error={errors.waterPerM3} inputMode="decimal" disabled={disabled} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Price per kg for {name}, where it differs</legend>
        <p className="text-xs text-ink-2">Empty means the fruit type's own price applies.</p>
        <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3">
          {fruitTypes.map((t) => (
            <TextField
              key={t.id}
              label={t.name}
              value={input.prices[t.id] ?? ''}
              onChange={setPrice(t.id)}
              error={errors[`price:${t.id}`]}
              hint={hintFor(t, input.prices[t.id], rates)}
              inputMode="decimal"
              disabled={disabled}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={disabled || saving} className={PRIMARY_BUTTON}>
          {saving ? 'Saving…' : `Save ${name} rates`}
        </button>
        {saved && <span role="status" className="text-sm font-semibold text-ok-ink">Saved.</span>}
        {rates?.updatedAt && <span className="text-xs text-ink-2">Last changed {formatDateTime(rates.updatedAt)}{rates.updatedBy ? ` by ${rates.updatedBy}` : ''}.</span>}
      </div>
    </form>
  )
}

/** "Fruit type: 2.8", and where this facility's own price came from while it is still the imported one. */
function hintFor(type: FruitType, typed: string | undefined, rates: Rates | undefined): string {
  const general = type.pricePerKg === null ? 'Fruit type: no price' : `Fruit type: ${type.pricePerKg}`
  const note = rates?.priceSources?.[type.id]
  return note && typed !== undefined && Number(typed) === rates?.priceOverrides?.[type.id] ? `${general}. ${marketPriceText(note)}` : general
}
