import { useState } from 'react'
import { DEFAULT_CURRENCY, type Catalog, type FacilityEntry } from '../../setup/catalog'
import { facilityCode } from '../../setup/codes'
import { validateFacility } from '../../setup/validate'
import type { Facility } from '../../workspace/types'
import { TextField } from '../ui/fields'
import { FormCard } from './FormCard'

/** Adds a facility, or edits the region and currency of one. The name and code stay, because cultivations and ids are built from them. */
export function FacilityForm({
  catalog,
  editing,
  disabled,
  onSave,
  onCancel,
}: {
  catalog: Catalog
  editing?: FacilityEntry
  disabled: boolean
  onSave: (facility: Facility) => Promise<boolean>
  onCancel: () => void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [code, setCode] = useState(editing?.id ?? '')
  const [codeTouched, setCodeTouched] = useState(false)
  const [region, setRegion] = useState(editing?.region ?? '')
  const [currency, setCurrency] = useState(editing?.currency ?? DEFAULT_CURRENCY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const typeName = (value: string) => {
    setName(value)
    if (!codeTouched) setCode(facilityCode(value))
  }

  async function submit() {
    const found = validateFacility({ code, name, region, currency }, { catalog, editingId: editing?.id ?? null })
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    const saved = await onSave({ id: code.trim().toUpperCase(), name: name.trim(), region: region.trim(), currency: currency.trim().toUpperCase() })
    setSaving(false)
    if (saved) onCancel()
  }

  return (
    <FormCard title={editing ? `Edit ${editing.name}` : 'Add a facility'} submitLabel={editing ? 'Save changes' : 'Add facility'} saving={saving} disabled={disabled} onSubmit={() => void submit()} onCancel={onCancel}>
      <TextField label="Name" value={name} onChange={typeName} error={errors.name} disabled={Boolean(editing)} hint={editing ? "The name can't change, because cultivations refer to it." : undefined} />
      <TextField
        label="Code"
        value={code}
        onChange={(v) => {
          setCode(v)
          setCodeTouched(true)
        }}
        error={errors.code}
        disabled={Boolean(editing)}
        hint="Starts every cultivation id, for example ON in ON-P2-TOV. Change it if it clashes."
      />
      <TextField label="Region" value={region} onChange={setRegion} error={errors.region} hint="For example Ontario, Canada. Optional." />
      <TextField label="Currency" value={currency} onChange={setCurrency} error={errors.currency} hint="Three letters, for example USD." />
    </FormCard>
  )
}
