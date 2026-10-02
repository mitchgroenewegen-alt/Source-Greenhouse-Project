import { Link } from 'react-router-dom'
import { cropWeekOn, formatDate } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import { fixed } from '../../lib/format'
import type { CultivationScore } from '../../scoring/summary'
import { FlagIcon } from '../ui/icons'
import { CategoryStatusList } from './CategoryStatusList'
import { HeadlineMetric } from './HeadlineMetric'

export function CultivationCard({
  cultivation,
  score,
  weekEnd,
  weekLabel,
  openFlags,
  openFlagsThisWeek,
}: {
  cultivation: Cultivation
  score: CultivationScore
  weekEnd: string
  weekLabel: string
  openFlags: number
  openFlagsThisWeek: number
}) {
  const kpi = (name: string) => score.kpis.find((k) => k.config.name === name)!
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            <Link to={`/cultivation/${cultivation.id}`} className="text-brand hover:underline">
              {cultivation.id}
            </Link>
          </h2>
          <p className="text-sm text-ink-2">
            {cultivation.facility} · {cultivation.greenhouse} · {cultivation.variety}
          </p>
          <p className="text-xs text-ink-3">
            {fixed(cultivation.areaM2, 0)} m² · planted {formatDate(cultivation.plantingDate)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
          Crop week {cropWeekOn(cultivation.plantingDate, weekEnd)}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <HeadlineMetric label="Cumulative harvest" result={kpi('Cumulative harvest')} />
        <HeadlineMetric label={`Harvest, ${weekLabel}`} result={kpi('Harvest')} />
        <HeadlineMetric label="Fruit weight" result={kpi('Fruit weight')} />
        <HeadlineMetric label="Waste" result={kpi('Waste')} />
      </div>

      <CategoryStatusList categories={score.categories} />

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
        <Link
          to={`/checks?cultivation=${cultivation.id}`}
          className={`flex min-h-9 items-center gap-1.5 text-sm font-semibold ${openFlags > 0 ? 'text-flag-ink' : 'text-ink-2'}`}
        >
          <FlagIcon width={16} height={16} />
          {openFlags === 0
            ? 'No open data flags'
            : `${openFlags} open data ${openFlags === 1 ? 'flag' : 'flags'}${openFlagsThisWeek > 0 ? ` (${openFlagsThisWeek} in ${weekLabel})` : ''}`}
        </Link>
        <Link to={`/cultivation/${cultivation.id}`} className="min-h-9 py-1.5 text-sm font-semibold text-brand hover:underline">
          Details
        </Link>
      </footer>
    </article>
  )
}
