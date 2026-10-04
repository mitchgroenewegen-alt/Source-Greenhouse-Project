import { useMemo, useState } from 'react'
import { formatDate } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import { kgToKgPerM2 } from '../../entry/harvest'
import { dateProblem, toNumber } from '../../entry/validate'
import { fixed } from '../../lib/format'
import { useCropData } from '../../state/CropDataContext'
import { SelectField, TextField } from '../ui/fields'
import { Segmented } from '../ui/Segmented'
import { EntryFormCard } from './EntryFormCard'
import { useEntryFlow } from './useEntryFlow'

type Unit = 'perM2' | 'total'

/** Harvest of one day for one cultivation, typed as kg/m² or as a total in kg (divided by the growing area). */
export function DailyProductionForm({ cultivations, createdBy }: { cultivations: Cultivation[]; createdBy: string }) {
  const { data } = useCropData()
  const [cultivationId, setCultivationId] = useState(cultivations[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [unit, setUnit] = useState<Unit>('perM2')
  const [value, setValue] = useState('')
  const cultivation = cultivations.find((c) => c.id === cultivationId)
  const flow = useEntryFlow(cultivation, createdBy)

  const typed = toNumber(value)
  const perM2 = unit === 'perM2' ? typed : cultivation ? kgToKgPerM2(typed, cultivation.areaM2) : null
  const existing = useMemo(
    () => (date === '' ? undefined : data.daily.find((r) => r.cultivation === cultivationId && r.kpi === 'Harvest' && r.date === date)),
    [data.daily, cultivationId, date],
  )

  const dateError = cultivation && date !== '' ? dateProblem(date, cultivation) : undefined
  const problem = !cultivation ? 'There is no cultivation to enter data for.' : dateProblem(date, cultivation) ?? (perM2 === null || !Number.isFinite(perM2) ? 'Type the harvest as a number.' : null)
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    flow.reset()
    set(v)
  }

  return (
    <EntryFormCard
      title="Daily production"
      intro="The harvest of one day. It is saved as the Harvest actual of that day; the budget of the day stays as it is."
      flow={flow}
      problem={problem}
      showProblem={date !== '' || value.trim() !== ''}
      submitLabel="Save harvest"
      onSubmit={() => flow.submit([{ cultivation: cultivationId, kpi: 'Harvest', date, actual: perM2 as number }])}
      onSaved={() => setValue('')}
    >
      <SelectField label="Cultivation" value={cultivationId} onChange={touch(setCultivationId)} options={cultivations.map((c) => ({ value: c.id, label: c.id }))} />
      <TextField label="Date" type="date" value={date} onChange={touch(setDate)} error={dateError} />
      <Segmented
        label="Typed as"
        options={[
          { value: 'perM2', label: 'kg/m²' },
          { value: 'total', label: 'Total kg' },
        ]}
        value={unit}
        onChange={touch(setUnit)}
      />
      <TextField
        label={unit === 'perM2' ? 'Harvest (kg/m²)' : 'Harvest (kg, whole cultivation)'}
        value={value}
        onChange={touch(setValue)}
        inputMode="decimal"
        hint={
          unit === 'total' && cultivation
            ? perM2 !== null && Number.isFinite(perM2)
              ? `That is ${fixed(perM2, 4)} kg/m², the total divided by the growing area of ${fixed(cultivation.areaM2, 0)} m².`
              : `The total is divided by the growing area of ${fixed(cultivation.areaM2, 0)} m² to give kg/m².`
            : undefined
        }
      />
      {existing?.actual != null && (
        <p className="text-sm">
          {formatDate(existing.date)} already has a harvest of {fixed(existing.actual, 3)} kg/m². Saving replaces it, and Undo in the edit log brings it back.
        </p>
      )}
    </EntryFormCard>
  )
}
