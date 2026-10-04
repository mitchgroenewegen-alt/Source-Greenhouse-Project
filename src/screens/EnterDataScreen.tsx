import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DailyProductionForm } from '../components/entry/DailyProductionForm'
import { SingleValueForm } from '../components/entry/SingleValueForm'
import { WeeklyRegistrationForm } from '../components/entry/WeeklyRegistrationForm'
import { ChevronLeftIcon } from '../components/ui/icons'
import { Segmented } from '../components/ui/Segmented'
import { useCropData } from '../state/CropDataContext'

type Form = 'daily' | 'weekly' | 'single'

/** Type in values: a day of production, a week of crop registration, or one value. Each goes through the data checks first. */
export default function EnterDataScreen() {
  const { cultivations, signedInAs, decidedBy } = useCropData()
  const [form, setForm] = useState<Form>('daily')
  // Only the cultivations that are still live can be entered for.
  const live = cultivations.filter((c) => !c.archived)
  const createdBy = signedInAs ?? decidedBy

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/data" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink hover:underline">
          <ChevronLeftIcon width={16} height={16} /> Data
        </Link>
        <h1 className="text-2xl font-semibold">Enter data</h1>
        <p>Typed values replace the day&apos;s value in the workbook. The workbook itself is never changed, and every entry can be undone in the edit log.</p>
      </div>

      <div className="rounded-2xl border border-line bg-card p-3">
        <Segmented
          label="Form"
          value={form}
          onChange={setForm}
          options={[
            { value: 'daily', label: 'Daily production' },
            { value: 'weekly', label: 'Weekly crop registration' },
            { value: 'single', label: 'Single value' },
          ]}
        />
      </div>

      {live.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm">There is no live cultivation to enter data for. Add one on Setup first.</p>
      ) : form === 'daily' ? (
        <DailyProductionForm cultivations={live} createdBy={createdBy} />
      ) : form === 'weekly' ? (
        <WeeklyRegistrationForm cultivations={live} createdBy={createdBy} />
      ) : (
        <SingleValueForm cultivations={live} createdBy={createdBy} />
      )}
    </div>
  )
}
