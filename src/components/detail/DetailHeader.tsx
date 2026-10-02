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

export function DetailHeader({ cultivation, weekEnd, weekLabel }: { cultivation: Cultivation; weekEnd: string; weekLabel: string }) {
  return (
    <header className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <Link to="/" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand hover:underline">
        <ChevronLeftIcon width={16} height={16} /> Scorecard
      </Link>
      <h1 className="text-2xl font-semibold">{cultivation.id}</h1>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Facility" value={cultivation.facility} />
        <Fact label="Greenhouse" value={cultivation.greenhouse} />
        <Fact label="Variety" value={cultivation.variety} />
        <Fact label="Planting date" value={formatDate(cultivation.plantingDate)} />
        <Fact label={`Crop week (end of ${weekLabel})`} value={String(cropWeekOn(cultivation.plantingDate, weekEnd))} />
        <Fact label="Growing area" value={`${fixed(cultivation.areaM2, 0)} m²`} />
      </dl>
    </header>
  )
}
