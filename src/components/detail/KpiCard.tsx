import { useMemo } from 'react'
import { planWord, type KpiConfig } from '../../config/kpis'
import { shortWeek } from '../../data/dates'
import type { WeekInfo } from '../../data/types'
import { directionText, formatValue, formatVariance, toleranceText } from '../../lib/kpiFormat'
import type { KpiResult } from '../../scoring/summary'
import type { WeeklyPoint } from '../../scoring/effective'
import type { SpecState } from '../../setup/fruitTypes'
import { diameterRangeText, weightRangeText } from '../../setup/fruitTypes'
import type { EditedWeek } from '../../editing/original'
import type { ChartForecast } from '../../forecast'
import type { FruitType } from '../../workspace/types'
import { StatusBadge } from '../ui/StatusBadge'
import { SpecBadge } from './SpecBadge'
import { buildChartModel } from './chartData'
import { ChartLegend, KpiChart } from './KpiChart'

/** One KPI: this week's number and status, then actual against its budget or target over all weeks. */
export function KpiCard({
  config,
  weeks,
  points,
  selectedWeek,
  result,
  spec,
  edited,
  onEdit,
  forecast = null,
  forecastNote,
}: {
  config: KpiConfig
  weeks: WeekInfo[]
  points: (WeeklyPoint | undefined)[]
  selectedWeek: string
  result: KpiResult
  /** Fruit weight only: the cultivation's fruit type and where the selected week's average sits in its range (null: no average that week). */
  spec?: { type: FruitType; state: SpecState | null }
  /** One entry per week (in the order of `weeks`) whose budget or target was edited. */
  edited: (EditedWeek | undefined)[]
  onEdit: () => void
  /** Harvest and Cumulative harvest only: the forecast line to draw after the actuals. */
  forecast?: ChartForecast | null
  /** How the forecast was made, one sentence under the chart. */
  forecastNote?: string
}) {
  const model = useMemo(() => buildChartModel(config, weeks, points, edited, forecast), [config, weeks, points, edited, forecast])
  const tolerance = toleranceText(config)
  const { point, score } = result
  const hasFlags = model.rows.some((r) => r.openFlags + r.decidedFlags > 0)
  const plan = planWord(config) // "budget" or "target", per KPI (src/config/kpis.ts)
  const summary = `${config.name}, ${shortWeek(selectedWeek)}: actual ${formatValue(config, point?.actual ?? null)}, ${plan} ${formatValue(config, point?.paired ? point.target : null)}`

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">{config.name}</h3>
          <p className="text-xs text-ink-3">
            {config.unit} · {directionText(config)}
          </p>
        </div>
        <StatusBadge status={score.status} label={score.status ? undefined : result.note === 'under-review' ? 'Under review' : result.note === 'no-target' ? `No ${plan}` : result.note === 'no-actual' ? 'Not recorded' : 'Not scored'} />
      </header>

      <p className="num text-sm text-ink-2">
        <span className="font-semibold text-ink">{shortWeek(selectedWeek)}</span> actual{' '}
        <span className="font-semibold text-ink">{formatValue(config, point?.actual ?? null)}</span>
        {point?.paired || point?.target != null ? (
          <>
            {' '}
            vs {plan} <span className="font-semibold text-ink">{formatValue(config, point.target)}</span>
          </>
        ) : null}
        {score.variance !== null && <span className="ml-1 font-semibold text-ink">({formatVariance(config, score.variance)})</span>}
      </p>

      {spec && (
        <p className="num text-sm text-ink-2">
          {spec.type.name} spec: <span className="font-semibold text-ink">{weightRangeText(spec.type)}</span>
          {diameterRangeText(spec.type) && `, ${diameterRangeText(spec.type)}`}
          {spec.type.placeholder && ' (placeholder)'}
          {spec.state ? <SpecBadge state={spec.state} /> : <span className="ml-1">No average this week.</span>}
        </p>
      )}

      {model.hasActual || model.hasTarget ? (
        // The plot sits on a tile, one step paler than the card, so the shaded bands stand out from the green card.
        <div role="img" aria-label={`Line chart over the weeks. ${summary}.${model.hasForecast ? ' A dashed forecast line with a shaded range follows the actuals.' : ''} The table below has every week.`} className="rounded-xl border border-line-soft bg-tile py-1.5 pr-1">
          <KpiChart config={config} model={model} weeks={weeks} selectedWeek={selectedWeek} />
        </div>
      ) : (
        <p className="rounded-xl border border-line-soft bg-tile p-4 text-center text-sm text-ink-2">Nothing was recorded for this KPI in this cultivation.</p>
      )}

      <ChartLegend hasTarget={model.hasTarget} hasFlags={hasFlags} hasEdits={model.hasEdits} hasForecast={model.hasForecast} planLabel={planWord(config, { capitalised: true })} />
      {model.hasForecast && forecastNote && <p className="text-xs text-ink-3">{forecastNote}</p>}
      <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center justify-center self-start rounded-lg border border-line-strong bg-field px-4 text-sm font-semibold text-ink">
        Edit {plan}
      </button>
      <p className="text-xs text-ink-3">
        {model.hasTarget
          ? `On track: ${tolerance.green}. Watch: ${tolerance.amber}.`
          : `The plan has no ${plan} for this KPI, so it is shown but not scored.`}
      </p>
    </article>
  )
}
