import { useState } from 'react'
import type { Catalog, GreenhouseEntry } from '../../setup/catalog'
import { greenhouseCode } from '../../setup/codes'
import { validateGreenhouse } from '../../setup/validate'
import type { Cultivation } from '../../data/types'
import type { Greenhouse } from '../../workspace/types'
import { SelectField, TextField } from '../ui/fields'
import { FormCard } from './FormCard'

/** Adds a greenhouse, or edits the area and the installed LED power of one. */
export function GreenhouseForm({
  catalog,
  cultivations,
  editing,
  facilityId,
  disabled,
  onSave,
  onCancel,
}: {
  catalog: Catalog
  cultivations: Cultivation[]
  editing?: GreenhouseEntry
  /** The facility to start with when adding. */
  facilityId?: string
  disabled: boolean
  onSave: (greenhouse: Greenhouse) => Promise<boolean>
  onCancel: () => void
}) {
  const [facility, setFacility] = useState(editing?.facilityId ?? facilityId ?? catalog.facilities[0]?.id ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [code, setCode] = useState(editing?.code ?? '')
  const [codeTouched, setCodeTouched] = useState(false)
  const [area, setArea] = useState(editing ? String(editing.areaM2) : '')
  const [led, setLed] = useState(editing?.ledWattsPerM2 == null ? '' : String(editing.ledWattsPerM2))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const typeName = (value: string) => {
    setName(value)
    if (!codeTouched) setCode(greenhouseCode(value))
  }

  async function submit() {
    const found = validateGreenhouse({ facilityId: facility, code, name, areaM2: area, ledWattsPerM2: led }, { catalog, cultivations, editingId: editing?.id ?? null })
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    const saved = await onSave({ id: `${facility}-${code.trim()}`, facilityId: facility, name: name.trim(), areaM2: Number(area), ledWattsPerM2: led.trim() === '' ? null : Number(led) })
    setSaving(false)
    if (saved) onCancel()
  }

  return (
    <FormCard title={editing ? `Edit ${editing.facilityName} ${editing.name}` : 'Add a greenhouse'} submitLabel={editing ? 'Save changes' : 'Add greenhouse'} saving={saving} disabled={disabled} onSubmit={() => void submit()} onCancel={onCancel}>
      <SelectField label="Facility" value={facility} onChange={setFacility} options={catalog.facilities.map((f) => ({ value: f.id, label: f.name }))} error={errors.facilityId} disabled={Boolean(editing)} />
      <TextField label="Name" value={name} onChange={typeName} error={errors.name} disabled={Boolean(editing)} hint={editing ? "The name can't change, because cultivations refer to it." : 'For example Phase 2.'} />
      <TextField
        label="Code"
        value={code}
        onChange={(v) => {
          setCode(v)
          setCodeTouched(true)
        }}
        error={errors.code}
        disabled={Boolean(editing)}
        hint={`Follows the facility code in cultivation ids${facility ? `, for example ${facility}-${code || 'P2'}-TOV` : ''}. Change it if it clashes.`}
      />
      <TextField label="Growing area (m²)" value={area} onChange={setArea} error={errors.areaM2} inputMode="decimal" />
      <TextField label="Installed LED power (W/m²)" value={led} onChange={setLed} error={errors.ledWattsPerM2} inputMode="decimal" hint="Optional." />
    </FormCard>
  )
}
