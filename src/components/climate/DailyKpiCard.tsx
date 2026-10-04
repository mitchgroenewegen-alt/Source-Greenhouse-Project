import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { planWord, type KpiConfig } from '../../config/kpis'
import { formatDate } from '../../data/dates'
import { dailyChartModel, type DailyChartRow } from '../../climate/chartModel'
import type { DayPoint } from '../../climate/days'
import { directionText, formatValue, formatVariance, toleranceText } from '../../lib/kpiFormat'
import { scoreWith, STATUS_LABEL } from '../../scoring/score'
import { BANDS } from '../detail/chartBands'
import { ACTUAL, ChartLegend, FlagMarker, markedDot, TARGET } from '../detail/KpiChart'
import { ClimateCard, EmptyPlot, PlotTile } from './ClimateCard'

const actualDot = markedDot<DailyChartRow>(ACTUAL, (r) => r.actualMark)
const targetDot = markedDot<DailyChartRow>(TARGET, (r) => r.targetMark)

function DayTooltip({ active, payload, config }: { active?: boolean; payload?: readonly { payload?: DailyChartRow }[]; config: KpiConfig }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const score = scoreWith(config, row.actual, row.target)
  return (
    <div className="rounded-lg border border-line-strong bg-field p-2.5 text-sm shadow-md">
      <div className="font-semibold">{formatDate(row.date)}</div>
      <div className="num mt-1 grid grid-cols-[auto_auto] gap-x-3">
        <span className="text-ink-2">Actual</span>
        <span className="text-right font-semibold">{formatValue(config, row.actual)}</span>
        <span className="text-ink-2">{planWord(config, { capitalised: true })}</span>
        <span className="text-right font-semibold">{formatValue(config, row.target)}</span>
        {score.variance !== null && (
          <>
            <span className="text-ink-2">Difference</span>
            <span className="text-right font-semibold">{formatVariance(config, score.variance)}</span>
          </>
        )}
      </div>
      {score.status && <div className="mt-1 text-xs font-semibold">{STATUS_LABEL[score.status]}</div>}
      {row.openFlags > 0 && <div className="mt-1 text-xs font-semibold text-flag-ink">{row.openFlags} flagged value(s) left out, waiting for a decision</div>}
      {row.decidedFlags > 0 && <div className="mt-1 text-xs text-flag-ink">{row.decidedFlags} flagged value(s) checked by a person</div>}
    </div>
  )
}

/** One climate KPI over the days shown: actual against its target, with the On track and Watch bands and the flag marks. */
export function DailyKpiCard({ config, points, highlight, tickLabel }: { config: KpiConfig; points: DayPoint[]; highlight: { from: string; to: string } | null; tickLabel: (date: string) => string }) {
  const model = useMemo(() => dailyChartModel(config, points), [config, points])
  const plan = planWord(config)
  const tolerance = toleranceText(config)
  const decimals = config.decimals
  const withData = points.filter((p) => p.actual !== null).length
  return (
    <ClimateCard title={config.name} note={`${config.unit} · ${directionText(config)}`}>
      {model.hasActual || model.hasTarget ? (
        <PlotTile label={`Line chart over ${points.length} days: ${config.name}, actual against ${plan}. ${withData} days have a value.`}>
          <div style={{ height: 180 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={model.rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickLabel} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} interval="preserveStartEnd" minTickGap={18} />
                <YAxis
                  domain={model.domain}
                  ticks={model.ticks}
                  allowDataOverflow
                  width={44}
                  tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => String(Number(v.toFixed(Math.min(decimals + 1, 3))))}
                />
                <Tooltip content={(props) => <DayTooltip {...props} config={config} />} cursor={{ stroke: 'var(--color-ink-3)', strokeDasharray: '2 3' }} />
                {highlight && <ReferenceArea x1={highlight.from} x2={highlight.to} fill="var(--color-brand)" fillOpacity={0.14} stroke="none" ifOverflow="extendDomain" />}
                <Area dataKey="amber" type="monotone" stroke="none" fill={BANDS.watch.fill} fillOpacity={BANDS.watch.opacity} isAnimationActive={false} activeDot={false} legendType="none" />
                <Area dataKey="amberAbove" type="monotone" stroke="none" fill={BANDS.watch.fill} fillOpacity={BANDS.watch.opacity} isAnimationActive={false} activeDot={false} legendType="none" />
                <Area dataKey="green" type="monotone" stroke="none" fill={BANDS.onTrack.fill} fillOpacity={BANDS.onTrack.opacity} isAnimationActive={false} activeDot={false} legendType="none" />
                <Line dataKey="target" type="monotone" stroke={TARGET} strokeWidth={2} strokeDasharray="5 4" dot={points.length > 31 ? false : targetDot} activeDot={{ r: 4 }} isAnimationActive={false} />
                <Line dataKey="actual" type="monotone" stroke={ACTUAL} strokeWidth={2} dot={points.length > 31 ? false : actualDot} activeDot={{ r: 5 }} isAnimationActive={false} />
                <Line dataKey="flagY" stroke="none" dot={FlagMarker} activeDot={false} isAnimationActive={false} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </PlotTile>
      ) : (
        <EmptyPlot>Nothing was recorded for this KPI on the days shown.</EmptyPlot>
      )}
      <ChartLegend hasTarget={model.hasTarget} hasFlags={model.hasFlags} planLabel={planWord(config, { capitalised: true })} />
      <p className="text-xs text-ink-3">{model.hasTarget ? `On track: ${tolerance.green}. Watch: ${tolerance.amber}.` : `No ${plan} on the days shown, so no status.`}</p>
    </ClimateCard>
  )
}
