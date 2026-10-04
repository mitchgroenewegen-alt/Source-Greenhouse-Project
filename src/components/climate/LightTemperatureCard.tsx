import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { niceScale } from '../detail/chartData'
import { formatDate } from '../../data/dates'
import type { LightTemperatureRow } from '../../climate/series'
import { fixed } from '../../lib/format'
import { ACTUAL, TARGET } from '../detail/KpiChart'
import { ChartKey, type KeyItem } from './ChartKey'
import { ClimateCard, EmptyPlot, PlotTile } from './ClimateCard'

const RADIATION_BAR = 'var(--color-budget)'

const num = (v: number | null, digits: number, unit: string) => (v === null ? '–' : `${fixed(v, digits)} ${unit}`)

function axisFor(values: (number | null)[], from0 = false): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter((v): v is number => v !== null)
  const lo = finite.length ? Math.min(...finite) : 0
  const hi = finite.length ? Math.max(...finite) : 1
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1
  const ticks = niceScale(from0 ? 0 : lo - pad, hi + pad)
  return { domain: [ticks[0]!, ticks[ticks.length - 1]!], ticks }
}

function Tip({ active, payload }: { active?: boolean; payload?: readonly { payload?: LightTemperatureRow }[] }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-lg border border-line-strong bg-field p-2.5 text-sm shadow-md">
      <div className="font-semibold">{formatDate(row.date)}</div>
      <div className="num mt-1 grid grid-cols-[auto_auto] gap-x-3">
        <span className="text-ink-2">Temperature (24h)</span>
        <span className="text-right font-semibold">{num(row.temperature, 1, '°C')}</span>
        <span className="text-ink-2">At the RTR target</span>
        <span className="text-right font-semibold">{num(row.rtrTemperature, 1, '°C')}</span>
        <span className="text-ink-2">Solar radiation</span>
        <span className="text-right font-semibold">{num(row.radiation, 0, 'J/cm²')}</span>
        <span className="text-ink-2">RTR now, target</span>
        <span className="text-right font-semibold">
          {row.rtrActual === null ? '–' : fixed(row.rtrActual, 4)}, {row.rtrTarget === null ? '–' : fixed(row.rtrTarget, 4)}
        </span>
      </div>
      {row.flagged && <div className="mt-1 text-xs font-semibold text-flag-ink">A value of this day is flagged by the data checks</div>}
    </div>
  )
}

/**
 * Did the heating follow the light? The 24-hour temperature of each day against the day's solar radiation (bars), with the
 * temperature the RTR target stands for as a dashed line: RTR is temperature divided by radiation, so target ratio times radiation.
 * A cultivation without an RTR target gets no dashed line, and the card says so.
 */
export function LightTemperatureCard({ rows, tickLabel }: { rows: LightTemperatureRow[]; tickLabel: (date: string) => string }) {
  const hasTemperature = rows.some((r) => r.temperature !== null)
  const hasRadiation = rows.some((r) => r.radiation !== null)
  const hasRtrLine = rows.some((r) => r.rtrTemperature !== null)
  const left = axisFor(rows.flatMap((r) => [r.temperature, r.rtrTemperature]))
  const right = axisFor(rows.map((r) => r.radiation), true)
  const key: KeyItem[] = [
    { label: 'Temperature (24h)', kind: 'line', color: ACTUAL },
    ...(hasRtrLine ? [{ label: 'Temperature at the RTR target', kind: 'dashed' as const, color: TARGET }] : []),
    { label: 'Solar radiation (right axis)', kind: 'bar', color: RADIATION_BAR },
  ]
  return (
    <ClimateCard title="Temperature and light" note="Did the temperature follow the light? Daily 24-hour temperature (°C, left) against solar radiation (J/cm², right).">
      {hasTemperature || hasRadiation ? (
        <PlotTile label="Chart over the days shown: the 24-hour temperature as a line, solar radiation as bars, and the temperature the RTR target stands for as a dashed line.">
          <div style={{ height: 210 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickLabel} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} interval="preserveStartEnd" minTickGap={18} />
                <YAxis yAxisId="t" domain={left.domain} ticks={left.ticks} allowDataOverflow width={36} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="r" orientation="right" domain={right.domain} ticks={right.ticks} allowDataOverflow width={40} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={false} />
                <Tooltip content={(props) => <Tip {...props} />} cursor={{ stroke: 'var(--color-ink-3)', strokeDasharray: '2 3' }} />
                <Bar yAxisId="r" dataKey="radiation" fill={RADIATION_BAR} fillOpacity={0.45} isAnimationActive={false} maxBarSize={18} />
                {hasRtrLine && <Line yAxisId="t" dataKey="rtrTemperature" type="monotone" stroke={TARGET} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                <Line yAxisId="t" dataKey="temperature" type="monotone" stroke={ACTUAL} strokeWidth={2} dot={rows.length > 31 ? false : { r: 3, fill: ACTUAL, stroke: 'var(--color-tile)', strokeWidth: 1.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </PlotTile>
      ) : (
        <EmptyPlot>No temperature or radiation was recorded on the days shown.</EmptyPlot>
      )}
      <ChartKey items={key} />
      <p className="text-xs text-ink-3">
        {hasRtrLine
          ? 'RTR is the 24-hour temperature divided by the day’s radiation sum, so the dashed line is the RTR target times the radiation: the temperature that would hit the target that day. A temperature line that rises and falls with the bars followed the light.'
          : 'This cultivation has no RTR target on the days shown, so there is no target line. The workbook has no radiation or temperature target to draw instead, and none is invented.'}
      </p>
    </ClimateCard>
  )
}
