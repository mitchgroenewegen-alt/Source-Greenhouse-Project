import { CATEGORY_LABEL } from '../../config/kpis'
import { formatVariance } from '../../lib/kpiFormat'
import type { CategoryResult } from '../../scoring/summary'
import { StatusBadge } from '../ui/StatusBadge'

function detail(c: CategoryResult): string {
  if (c.worst) {
    const { config, score } = c.worst
    const others = c.scoredCount - 1
    const base = c.status === 'green' ? `Weakest: ${config.name}` : `Worst: ${config.name} (${formatVariance(config, score.variance)})`
    return others > 0 ? `${base} · ${c.scoredCount} KPIs scored` : base
  }
  return c.underReview > 0 ? 'Waiting for data checks' : 'No KPI with a budget this week'
}

/** One row per category; the status is that of its worst KPI, and the row says which KPI that is. */
export function CategoryStatusList({ categories }: { categories: CategoryResult[] }) {
  return (
    <ul className="divide-y divide-line-soft border-t border-line-soft">
      {categories.map((c) => (
        <li key={c.category} className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{CATEGORY_LABEL[c.category]}</div>
            <div className="text-xs text-ink-2">{detail(c)}</div>
          </div>
          <StatusBadge status={c.status} label={c.status === null && c.underReview > 0 ? 'Under review' : undefined} />
        </li>
      ))}
    </ul>
  )
}
