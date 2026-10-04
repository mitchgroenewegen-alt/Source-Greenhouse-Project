import { useMemo, useState } from 'react'
import { kpiConfig, kpisInCategory, type KpiConfig } from '../../config/kpis'
import { formatDate, formatRange, shortWeek, weekdayName, weekdayOf } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import type { EntryValue } from '../../entry/entries'
import { previousWeek, registrationDate, registrationWeekday, weekChoices } from '../../entry/registration'
import { optionalNumberProblem, toNumber } from '../../entry/validate'
import { formatValue } from '../../lib/kpiFormat'
import { useCropData } from '../../state/CropDataContext'
import { useView } from '../../state/ViewContext'
import { SelectField, TextField } from '../ui/fields'
import { EntryFormCard } from './EntryFormCard'
import { useEntryFlow } from './useEntryFlow'

/** What the weekly registration asks for: every Plant KPI, and Waste. */
const REGISTERED: KpiConfig[] = [...kpisInCategory('Plant'), kpiConfig('Waste')]

/**
 * The crop registration of one week: one field per Plant KPI and Waste, each with last week's value. A field left empty is
 * skipped. Each value is saved on the weekday the KPI is registered on for that cultivation (see registrationWeekday).
 */
export function WeeklyRegistrationForm({ cultivations, createdBy }: { cultivations: Cultivation[]; createdBy: string }) {
  const { data, weeks } = useCropData()
  const view = useView()
  const [cultivationId, setCultivationId] = useState(cultivations[0]?.id ?? '')
  const [week, setWeek] = useState(view.week)
  const [values, setValues] = useState<Record<string, string>>({})
  const cultivation = cultivations.find((c) => c.id === cultivationId)
  const flow = useEntryFlow(cultivation, createdBy)

  const choices = useMemo(() => weekChoices(weeks), [weeks])
  const lastWeek = previousWeek(week)
  const lastWeekValues = useMemo(() => {
    const found = new Map<string, number | null>()
    for (const w of data.weekly) if (w.cultivation === cultivationId && w.week === lastWeek) found.set(w.kpi, w.actual)
    return found
  }, [data.weekly, cultivationId, lastWeek])
  // The weekday each KPI is saved on for this cultivation, worked out from the days it has recorded values on.
  const weekdays = useMemo(() => new Map(REGISTERED.map((k) => [k.name, registrationWeekday(data.daily, cultivationId, k.name)])), [data.daily, cultivationId])

  const errors = new Map(REGISTERED.map((k) => [k.name, optionalNumberProblem(values[k.name] ?? '')]))
  const filled = REGISTERED.filter((k) => (values[k.name] ?? '').trim() !== '')
  const problem = filled.length === 0 ? 'Type at least one value.' : [...errors.values()].some(Boolean) ? 'Fix the fields marked above.' : null
  const entries = (): EntryValue[] =>
    filled.map((k) => ({ cultivation: cultivationId, kpi: k.name, date: registrationDate(week, weekdays.get(k.name)!), actual: toNumber(values[k.name]!) }))

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    flow.reset()
    set(v)
  }
  const info = choices.find((w) => w.id === week)

  return (
    <EntryFormCard
      title="Weekly crop registration"
      intro="The plant measurements of one week, and waste. Leave a field empty to skip it. Each value is saved on the day of the week this cultivation registers it on, usually the Monday (waste: the Sunday)."
      flow={flow}
      problem={problem}
      showProblem={filled.length > 0}
      submitLabel={filled.length === 0 ? 'Save values' : `Save ${filled.length} ${filled.length === 1 ? 'value' : 'values'}`}
      onSubmit={() => flow.submit(entries())}
      onSaved={() => setValues({})}
    >
      <SelectField label="Cultivation" value={cultivationId} onChange={touch(setCultivationId)} options={cultivations.map((c) => ({ value: c.id, label: c.id }))} />
      <SelectField
        label="Week"
        value={week}
        onChange={touch(setWeek)}
        options={choices.map((w) => ({ value: w.id, label: `${shortWeek(w.id)}, ${formatRange(w.start, w.end)}` }))}
        hint={info ? `Last week was ${shortWeek(lastWeek)}.` : undefined}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REGISTERED.map((k) => {
          const last = lastWeekValues.get(k.name)
          const date = registrationDate(week, weekdays.get(k.name)!)
          return (
            <TextField
              key={k.name}
              label={`${k.name} (${k.unit})`}
              value={values[k.name] ?? ''}
              onChange={touch((v: string) => setValues((all) => ({ ...all, [k.name]: v })))}
              inputMode="decimal"
              error={errors.get(k.name)}
              hint={`${last === null || last === undefined ? 'No value last week.' : `Last week: ${formatValue(k, last)} ${k.unit}.`} Saved on ${weekdayName(weekdayOf(date))} ${formatDate(date)}.`}
            />
          )
        })}
      </div>
    </EntryFormCard>
  )
}
