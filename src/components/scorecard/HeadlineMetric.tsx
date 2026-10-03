import { planWord } from '../../config/kpis'
import type { KpiResult } from '../../scoring/summary'
import { formatValue, formatVariance } from '../../lib/kpiFormat'
import { StatusBadge } from '../ui/StatusBadge'
import { gaugeModel } from './gauge'
import { KpiGauge } from './KpiGauge'

/**
 * One of the four numbers on a cultivation card: actual, budget, and how far apart they are (all four are Production KPIs, so "budget").
 * A KPI with a `gauge` setting (Waste) also gets a meter under the value, when the week has both an actual and a budget.
 */
export function HeadlineMetric({ result, label }: { result: KpiResult; label: string }) {
  const { config, point, score } = result
  const actual = point?.actual ?? null
  const budget = point?.paired ? point.target : null
  const plan = planWord(config)
  const Plan = planWord(config, { capitalised: true })
  const gauge = config.gauge ? gaugeModel(actual, budget, config.gauge.rangeOfBudget, config.decimals) : null
  const figures = (
    <>
      <div className="num text-xs text-ink-2">
        {budget === null ? (result.note === 'under-review' ? `${Plan} under review` : `No ${plan}`) : `${Plan} ${formatValue(config, budget)}`}
        {score.variance !== null && <span className="ml-1 font-semibold text-ink">{formatVariance(config, score.variance)}</span>}
      </div>
      <div className="mt-1.5">
        <StatusBadge status={score.status} label={score.status ? undefined : result.note === 'under-review' ? 'Under review' : 'Not scored'} />
      </div>
    </>
  )
  return (
    <div className="rounded-xl border border-line-soft bg-page/60 p-2.5">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="num mt-0.5 flex items-baseline gap-1">
        <span className="text-xl font-semibold">{formatValue(config, actual)}</span>
        <span className="text-xs text-ink-3">{config.unit}</span>
      </div>
      {gauge ? (
        // On a phone the meter sits under the value with the figures below it; a wide tile puts them side by side.
        <div className="@container">
          <div className="mt-1 flex flex-col gap-1.5 @[14rem]:flex-row @[14rem]:items-center @[14rem]:gap-3">
            <KpiGauge config={config} model={gauge} status={score.status} />
            <div className="min-w-0">{figures}</div>
          </div>
        </div>
      ) : (
        figures
      )}
    </div>
  )
}
