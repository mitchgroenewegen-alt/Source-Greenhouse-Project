import { planWord, type KpiConfig } from '../../config/kpis'
import { shortWeek } from '../../data/dates'
import { formatValue } from '../../lib/kpiFormat'
import type { WeekPreview } from '../../editing/plan'

/** Each week the edit touches, with its weekly value now and after the edit. */
export function EditPreview({ config, weeks }: { config: KpiConfig; weeks: WeekPreview[] }) {
  if (weeks.length === 0) return null
  return (
    <div className="rounded-xl border border-line-soft bg-tile p-2.5 text-sm">
      <div className="mb-1 text-xs font-semibold text-ink-2">
        Weekly {planWord(config)}, now and after ({config.unit})
      </div>
      <ul className="num grid max-h-44 grid-cols-1 gap-0.5 overflow-y-auto">
        {weeks.map((w) => (
          <li key={w.week} className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{shortWeek(w.week)}</span>
            <span>
              {formatValue(config, w.before)} → <span className="font-semibold">{formatValue(config, w.after)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
