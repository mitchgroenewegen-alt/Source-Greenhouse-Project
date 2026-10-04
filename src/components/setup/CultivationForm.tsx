import { useState } from 'react'
import type { Cultivation } from '../../data/types'
import { fixed } from '../../lib/format'
import type { Catalog } from '../../setup/catalog'
import { cultivationIdFor, freeId } from '../../setup/codes'
import { fruitTypeIdOf } from '../../setup/fruitTypes'
import { areaLeft, defaultPlannedEnd, isIsoDate, validateCultivation } from '../../setup/validate'
import type { FruitType, WorkspaceCultivation } from '../../workspace/types'
import { SelectField, TextField } from '../ui/fields'
import { FormCard } from './FormCard'

/**
 * Adds a cultivation, or edits one. An edit changes the fruit type, the planned end date and the area (and, for one added in
 * the app, the planting date). The workbook's own planting date, and every cultivation's greenhouse, variety and id, stay.
 */
export function CultivationForm({
  catalog,
  cultivations,
  fruitTypes,
  editing,
  fromWorkbook,
  greenhouseId,
  disabled,
  onSave,
  onCancel,
}: {
  catalog: Catalog
  /** Every cultivation, archived ones too. */
  cultivations: Cultivation[]
  fruitTypes: FruitType[]
  editing?: Cultivation
  fromWorkbook?: boolean
  /** The greenhouse to start with when adding. */
  greenhouseId?: string
  disabled: boolean
  onSave: (cultivation: WorkspaceCultivation) => Promise<boolean>
  onCancel: () => void
}) {
  const initialGreenhouse = editing ? catalog.greenhouses.find((g) => g.facilityName === editing.facility && g.name === editing.greenhouse)?.id ?? '' : greenhouseId ?? ''
  const [greenhouse, setGreenhouse] = useState(initialGreenhouse)
  const [fruitType, setFruitType] = useState((editing && fruitTypeIdOf(editing)) ?? '')
  const [variety, setVariety] = useState(editing?.variety ?? '')
  const [id, setId] = useState(editing?.id ?? '')
  const [idTouched, setIdTouched] = useState(false)
  const [planting, setPlanting] = useState(editing?.plantingDate ?? '')
  const [end, setEnd] = useState(editing ? editing.plannedEndDate ?? '' : '')
  const [endTouched, setEndTouched] = useState(false)
  const [area, setArea] = useState(editing ? String(editing.areaM2) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const taken = cultivations.map((c) => c.id)
  // While adding, the id follows the greenhouse and variety until the person types one; it is made free of clashes with -2, -3, ...
  const suggest = (gh: string, v: string) => freeId(cultivationIdFor(gh, v), taken)
  const change = (next: { gh?: string; v?: string }) => {
    const gh = next.gh ?? greenhouse
    const v = next.v ?? variety
    if (next.gh !== undefined) setGreenhouse(gh)
    if (next.v !== undefined) setVariety(v)
    if (!editing && !idTouched) setId(suggest(gh, v))
  }
  const changePlanting = (value: string) => {
    setPlanting(value)
    // 48 weeks from planting, until a planned end date is typed.
    if (!endTouched && !(editing && editing.plannedEndDate) && isIsoDate(value)) setEnd(defaultPlannedEnd(value))
  }

  const chosen = catalog.greenhouses.find((g) => g.id === greenhouse)
  const free = chosen ? areaLeft(chosen, cultivations, editing?.id ?? null).free : null

  async function submit() {
    const found = validateCultivation(
      { id, greenhouseId: greenhouse, fruitType, variety, plantingDate: planting, plannedEndDate: end, areaM2: area },
      { catalog, cultivations, fruitTypeIds: fruitTypes.map((t) => t.id), editingId: editing?.id ?? null, live: !editing?.archived },
    )
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    const record: WorkspaceCultivation = editing
      ? { ...editing, plantingDate: planting, areaM2: Number(area), fruitType, plannedEndDate: end || null, archived: editing.archived ?? false }
      : { id: id.trim(), facility: chosen!.facilityName, greenhouse: chosen!.name, crop: 'Tomato', variety: variety.trim(), plantingDate: planting, areaM2: Number(area), cropWeekAtEnd: 0, fruitType, plannedEndDate: end || null, archived: false }
    const saved = await onSave(record)
    setSaving(false)
    if (saved) onCancel()
  }

  return (
    <FormCard title={editing ? `Edit ${editing.id}` : 'Add a cultivation'} submitLabel={editing ? 'Save changes' : 'Add cultivation'} saving={saving} disabled={disabled} onSubmit={() => void submit()} onCancel={onCancel}>
      <SelectField
        label="Greenhouse"
        value={greenhouse}
        onChange={(gh) => change({ gh })}
        options={catalog.greenhouses.map((g) => ({ value: g.id, label: `${g.facilityName}, ${g.name}` }))}
        placeholder="Choose a greenhouse"
        error={errors.greenhouseId}
        disabled={Boolean(editing)}
        hint={free === null ? undefined : `${fixed(Math.max(free, 0), 0)} m² of its ${fixed(chosen!.areaM2, 0)} m² ${editing ? 'left for this cultivation' : 'still free'}.`}
      />
      <SelectField label="Fruit type" value={fruitType} onChange={setFruitType} options={fruitTypes.map((t) => ({ value: t.id, label: t.name }))} placeholder="Choose a fruit type" error={errors.fruitType} />
      <TextField label="Variety" value={variety} onChange={(v) => change({ v })} error={errors.variety} disabled={Boolean(editing)} hint={editing ? undefined : 'For example TOV. It ends the id.'} />
      <TextField
        label="Id"
        value={id}
        onChange={(v) => {
          setId(v)
          setIdTouched(true)
        }}
        error={errors.id}
        disabled={Boolean(editing)}
        hint={editing ? "The id can't change." : 'Built from the greenhouse and variety. Change it if you want another.'}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Planting date" type="date" value={planting} onChange={changePlanting} error={errors.plantingDate} disabled={Boolean(fromWorkbook)} hint={fromWorkbook ? "The workbook's planting date stays." : undefined} />
        <TextField label="Planned end date" type="date" value={end} onChange={(v) => { setEnd(v); setEndTouched(true) }} error={errors.plannedEndDate} hint="48 weeks after planting unless you change it." />
      </div>
      <TextField label="Growing area (m²)" value={area} onChange={setArea} error={errors.areaM2} inputMode="decimal" />
    </FormCard>
  )
}
