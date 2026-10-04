import { Link } from 'react-router-dom'
import { cropWeekOn, formatDate } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import { fixed } from '../../lib/format'
import { ChevronLeftIcon } from '../ui/icons'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="num truncate text-sm font-semibold">{value}</dd>
    </div>
  )
}

export function DetailHeader({ cultivation, fruitTypeName, weekEnd, weekLabel }: { cultivation: Cultivation; fruitTypeName: string | null; weekEnd: string; weekLabel: string }) {
  return (
    <header className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <Link to="/" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand hover:underline">
        <ChevronLeftIcon width={16} height={16} /> Scorecard
      </Link>
      <h1 className="text-2xl font-semibold">
        {cultivation.id}
        {cultivation.archived && <span className="ml-2 align-middle rounded-full border border-none-line bg-none-bg px-2 py-0.5 text-xs font-semibold text-none-ink">Archived</span>}
      </h1>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Fact label="Facility" value={cultivation.facility} />
        <Fact label="Greenhouse" value={cultivation.greenhouse} />
        <Fact label="Variety" value={cultivation.variety} />
        <Fact label="Fruit type" value={fruitTypeName ?? 'Not set'} />
        <Fact label="Planting date" value={formatDate(cultivation.plantingDate)} />
        <Fact label={`Crop week (end of ${weekLabel})`} value={String(cropWeekOn(cultivation.plantingDate, weekEnd))} />
        <Fact label="Growing area" value={`${fixed(cultivation.areaM2, 0)} m²`} />
        {cultivation.plannedEndDate && <Fact label="Planned end" value={formatDate(cultivation.plannedEndDate)} />}
      </dl>
    </header>
  )
}
