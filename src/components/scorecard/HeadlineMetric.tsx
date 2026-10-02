import { planWord } from '../../config/kpis'
import type { KpiResult } from '../../scoring/summary'
import { formatValue, formatVariance } from '../../lib/kpiFormat'
import { StatusBadge } from '../ui/StatusBadge'

/** One of the four numbers on a cultivation card: actual, budget, and how far apart they are (all four are Production KPIs, so "budget"). */
export function HeadlineMetric({ result, label }: { result: KpiResult; label: string }) {
  const { config, point, score } = result
  const actual = point?.actual ?? null
  const budget = point?.paired ? point.target : null
  const plan = planWord(config)
  const Plan = planWord(config, { capitalised: true })
  return (
    <div className="rounded-xl border border-line-soft bg-page/60 p-2.5">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="num mt-0.5 flex items-baseline gap-1">
        <span className="text-xl font-semibold">{formatValue(config, actual)}</span>
        <span className="text-xs text-ink-3">{config.unit}</span>
      </div>
      <div className="num text-xs text-ink-2">
        {budget === null ? (result.note === 'under-review' ? `${Plan} under review` : `No ${plan}`) : `${Plan} ${formatValue(config, budget)}`}
        {score.variance !== null && <span className="ml-1 font-semibold text-ink">{formatVariance(config, score.variance)}</span>}
      </div>
      <div className="mt-1.5">
        <StatusBadge status={score.status} label={score.status ? undefined : result.note === 'under-review' ? 'Under review' : 'Not scored'} />
      </div>
    </div>
  )
}
