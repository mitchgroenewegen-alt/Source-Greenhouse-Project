import { useMemo, useState } from 'react'
import { KPI_CONFIG, kpiConfig, planWord } from '../../config/kpis'
import { formatDate } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import type { EntryValue } from '../../entry/entries'
import { dateProblem, optionalNumberProblem, toNumber } from '../../entry/validate'
import { formatValue } from '../../lib/kpiFormat'
import { useCropData } from '../../state/CropDataContext'
import { SelectField, TextField } from '../ui/fields'
import { EntryFormCard } from './EntryFormCard'
import { useEntryFlow } from './useEntryFlow'

/** One KPI of one day for one cultivation: the actual, the budget or target, or both. */
export function SingleValueForm({ cultivations, createdBy }: { cultivations: Cultivation[]; createdBy: string }) {
  const { data } = useCropData()
  const [cultivationId, setCultivationId] = useState(cultivations[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [kpi, setKpi] = useState(KPI_CONFIG[0]!.name)
  const [actual, setActual] = useState('')
  const [target, setTarget] = useState('')
  const cultivation = cultivations.find((c) => c.id === cultivationId)
  const flow = useEntryFlow(cultivation, createdBy)
  const config = kpiConfig(kpi)
  const plan = planWord(config)

  const existing = useMemo(
    () => (date === '' ? undefined : data.daily.find((r) => r.cultivation === cultivationId && r.kpi === kpi && r.date === date)),
    [data.daily, cultivationId, kpi, date],
  )
  const actualError = optionalNumberProblem(actual)
  const targetError = optionalNumberProblem(target)
  const dateError = cultivation && date !== '' ? dateProblem(date, cultivation) : undefined
  const typedAny = actual.trim() !== '' || target.trim() !== ''
  const problem = !cultivation
    ? 'There is no cultivation to enter data for.'
    : (dateProblem(date, cultivation) ?? (!typedAny ? `Type an actual, a ${plan}, or both.` : actualError || targetError ? 'Fix the fields marked above.' : null))

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    flow.reset()
    set(v)
  }
  const value: EntryValue = {
    cultivation: cultivationId,
    kpi,
    date,
    ...(actual.trim() !== '' && { actual: toNumber(actual) }),
    ...(target.trim() !== '' && { target: toNumber(target) }),
  }

  return (
    <EntryFormCard
      title="Single value"
      intro="One KPI on one day: the actual, the budget or target, or both. A value you leave empty keeps what the day has now."
      flow={flow}
      problem={problem}
      showProblem={date !== '' || typedAny}
      submitLabel="Save value"
      onSubmit={() => flow.submit([value])}
      onSaved={() => {
        setActual('')
        setTarget('')
      }}
    >
      <SelectField label="Cultivation" value={cultivationId} onChange={touch(setCultivationId)} options={cultivations.map((c) => ({ value: c.id, label: c.id }))} />
      <TextField label="Date" type="date" value={date} onChange={touch(setDate)} error={dateError} />
      <SelectField label="KPI" value={kpi} onChange={touch(setKpi)} options={KPI_CONFIG.map((k) => ({ value: k.name, label: `${k.name} (${k.unit})` }))} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label={`Actual (${config.unit})`} value={actual} onChange={touch(setActual)} inputMode="decimal" error={actualError} />
        <TextField label={`${planWord(config, { capitalised: true })} (${config.unit})`} value={target} onChange={touch(setTarget)} inputMode="decimal" error={targetError} />
      </div>
      {existing && (
        <p className="text-sm">
          {formatDate(existing.date)} has an actual of {formatValue(config, existing.actual)} and a {plan} of {formatValue(config, existing.target)} {config.unit} now.
        </p>
      )}
    </EntryFormCard>
  )
}
