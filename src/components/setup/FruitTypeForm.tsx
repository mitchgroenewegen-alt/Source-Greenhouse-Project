import { useState, type FormEvent } from 'react'
import { fruitTypeFormOf, fruitTypeFromForm, fruitTypeId, validateFruitType } from '../../setup/fruitTypes'
import type { FruitType } from '../../workspace/types'
import { CheckField, PRIMARY_BUTTON, SECONDARY_BUTTON, TextField } from '../ui/fields'

/** Adds a fruit type, or edits (and renames) one. The id stays as it was, so cultivations keep their type when it is renamed. */
export function FruitTypeForm({
  type,
  others,
  disabled,
  onSave,
  onCancel,
}: {
  /** The type being edited; leave out to add a new one. */
  type?: FruitType
  others: FruitType[]
  disabled: boolean
  onSave: (type: FruitType) => Promise<boolean>
  onCancel: () => void
}) {
  const [input, setInput] = useState(() => fruitTypeFormOf(type))
  const [placeholder, setPlaceholder] = useState(type?.placeholder ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (field: keyof typeof input) => (value: string) => setInput((prev) => ({ ...prev, [field]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateFruitType(input, others)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    const id = type?.id ?? fruitTypeId(input.name, others.map((o) => o.id))
    const saved = await onSave(fruitTypeFromForm(id, input, placeholder, type))
    setSaving(false)
    if (saved) onCancel()
  }

  return (
    <form onSubmit={submit} noValidate aria-label={type ? `Edit ${type.name}` : 'Add a fruit type'} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{type ? `Edit ${type.name}` : 'Add a fruit type'}</h2>
      <TextField label="Name" value={input.name} onChange={set('name')} error={errors.name} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Lowest weight (g)" value={input.weightMinG} onChange={set('weightMinG')} error={errors.weightMinG} inputMode="decimal" />
        <TextField label="Highest weight (g)" value={input.weightMaxG} onChange={set('weightMaxG')} error={errors.weightMaxG} inputMode="decimal" />
        <TextField label="Smallest diameter (mm)" value={input.diameterMinMm} onChange={set('diameterMinMm')} error={errors.diameterMinMm} inputMode="decimal" hint="Optional" />
        <TextField label="Largest diameter (mm)" value={input.diameterMaxMm} onChange={set('diameterMaxMm')} error={errors.diameterMaxMm} inputMode="decimal" hint="Optional" />
      </div>
      <TextField label="Price per kg" value={input.pricePerKg} onChange={set('pricePerKg')} error={errors.pricePerKg} inputMode="decimal" hint="Optional. Used later in Financials." />
      <CheckField label="These numbers are a placeholder" checked={placeholder} onChange={setPlaceholder} hint="Untick it once they are the real specs." />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={disabled || saving} className={PRIMARY_BUTTON}>
          {saving ? 'Saving…' : type ? 'Save changes' : 'Add fruit type'}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
          Cancel
        </button>
      </div>
    </form>
  )
}
