import { useMemo } from 'react'
import type { KpiConfig } from '../../config/kpis'
import { shortWeek } from '../../data/dates'
import type { WeekInfo } from '../../data/types'
import { directionText, formatValue, formatVariance, toleranceText } from '../../lib/kpiFormat'
import type { KpiResult } from '../../scoring/summary'
import type { WeeklyPoint } from '../../scoring/effective'
import { StatusBadge } from '../ui/StatusBadge'
import { buildChartModel } from './chartData'
import { ChartLegend, KpiChart } from './KpiChart'

/** One KPI: this week's number and status, then actual against budget over all weeks. */
export function KpiCard({
  config,
  weeks,
  points,
  selectedWeek,
  result,
}: {
  config: KpiConfig
  weeks: WeekInfo[]
  points: (WeeklyPoint | undefined)[]
  selectedWeek: string
  result: KpiResult
}) {
  const model = useMemo(() => buildChartModel(config, weeks, points), [config, weeks, points])
  const tolerance = toleranceText(config)
  const { point, score } = result
  const hasFlags = model.rows.some((r) => r.openFlags + r.decidedFlags > 0)
  const summary = `${config.name}, ${shortWeek(selectedWeek)}: actual ${formatValue(config, point?.actual ?? null)}, budget ${formatValue(config, point?.paired ? point.target : null)}`

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3.5 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">{config.name}</h3>
          <p className="text-xs text-ink-3">
            {config.unit} · {directionText(config)}
          </p>
        </div>
        <StatusBadge status={score.status} label={score.status ? undefined : result.note === 'under-review' ? 'Under review' : result.note === 'no-target' ? 'No budget' : 'Not scored'} />
      </header>

      <p className="num text-sm text-ink-2">
        <span className="font-semibold text-ink">{shortWeek(selectedWeek)}</span> actual{' '}
        <span className="font-semibold text-ink">{formatValue(config, point?.actual ?? null)}</span>
        {point?.paired || point?.target != null ? (
          <>
            {' '}
            vs budget <span className="font-semibold text-ink">{formatValue(config, point.target)}</span>
          </>
        ) : null}
        {score.variance !== null && <span className="ml-1 font-semibold text-ink">({formatVariance(config, score.variance)})</span>}
      </p>

      {model.hasActual || model.hasTarget ? (
        <div role="img" aria-label={`Line chart over the weeks. ${summary}. The table below has every week.`}>
          <KpiChart config={config} model={model} weeks={weeks} selectedWeek={selectedWeek} />
        </div>
      ) : (
        <p className="rounded-lg bg-page p-4 text-center text-sm text-ink-2">Nothing was recorded for this KPI in this cultivation.</p>
      )}

      <ChartLegend hasTarget={model.hasTarget} hasFlags={hasFlags} />
      <p className="text-xs text-ink-3">
        {model.hasTarget
          ? `On track: ${tolerance.green}. Watch: ${tolerance.amber}.`
          : 'The plan has no budget for this KPI, so it is shown but not scored.'}
      </p>
    </article>
  )
}
