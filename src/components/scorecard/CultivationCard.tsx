import { Link } from 'react-router-dom'
import { cropWeekOn, formatDate } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import type { SeasonEnd } from '../../forecast'
import { fixed } from '../../lib/format'
import type { CultivationScore } from '../../scoring/summary'
import type { DataState } from '../../setup/dataState'
import { FlagIcon } from '../ui/icons'
import { CategoryStatusList } from './CategoryStatusList'
import { HeadlineMetric } from './HeadlineMetric'
import { NoDataTile } from './NoDataTile'

export function CultivationCard({
  cultivation,
  score,
  state,
  weekEnd,
  weekLabel,
  openFlags,
  openFlagsThisWeek,
  seasonEnd,
}: {
  cultivation: Cultivation
  score: CultivationScore
  /** Anything but 'ready' replaces the numbers with a note. */
  state: DataState
  weekEnd: string
  weekLabel: string
  openFlags: number
  openFlagsThisWeek: number
  /** The forecast at the end of the season: only a cultivation with a season budget has one, and only then does the card say so. */
  seasonEnd?: SeasonEnd | null
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
            {cultivation.archived && ' · Archived'}
          </p>
          <p className="text-xs text-ink-3">
            {fixed(cultivation.areaM2, 0)} m² · planted {formatDate(cultivation.plantingDate)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
          Crop week {cropWeekOn(cultivation.plantingDate, weekEnd)}
        </span>
      </header>

      {state !== 'ready' ? (
        <NoDataTile state={state} />
      ) : (
        <>
        <div className="grid grid-cols-2 gap-2">
          <HeadlineMetric label="Cumulative harvest" result={kpi('Cumulative harvest')} />
          <HeadlineMetric label={`Harvest, ${weekLabel}`} result={kpi('Harvest')} />
          <HeadlineMetric label="Fruit weight" result={kpi('Fruit weight')} />
          <HeadlineMetric label="Waste" result={kpi('Waste')} />
        </div>

        {seasonEnd && (
          <p className="num rounded-xl border border-line-soft bg-tile px-3 py-2 text-sm text-ink-2">
            Forecast at end <span className="font-semibold text-ink">{fixed(seasonEnd.expected, 1)} kg/m²</span>
            <span className="block text-xs text-ink-3">{fixed(seasonEnd.low, 1)} to {fixed(seasonEnd.high, 1)}</span>
          </p>
        )}

        <CategoryStatusList categories={score.categories} />
        </>
      )}

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
