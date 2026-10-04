import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { kpiConfig } from '../../config/kpis'
import { formatDate } from '../../data/dates'
import { LED_HOURS, PAR } from '../../climate/kpis'
import type { LightHoursRow } from '../../climate/series'
import { fixed } from '../../lib/format'
import { ACTUAL, TARGET } from '../detail/KpiChart'
import { niceScale } from '../detail/chartData'
import { ChartKey, type KeyItem } from './ChartKey'
import { ClimateCard, EmptyPlot, PlotTile } from './ClimateCard'

const LED_BAR = 'var(--color-budget)'

const num = (v: number | null, digits: number, unit: string) => (v === null ? '–' : `${fixed(v, digits)} ${unit}`)

function axis(values: (number | null)[]): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter((v): v is number => v !== null)
  const hi = finite.length ? Math.max(...finite) : 1
  const ticks = niceScale(0, hi * 1.08 || 1)
  return { domain: [0, ticks[ticks.length - 1]!], ticks }
}

function Tip({ active, payload }: { active?: boolean; payload?: readonly { payload?: LightHoursRow }[] }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-lg border border-line-strong bg-field p-2.5 text-sm shadow-md">
      <div className="font-semibold">{formatDate(row.date)}</div>
      <div className="num mt-1 grid grid-cols-[auto_auto] gap-x-3">
        <span className="text-ink-2">PAR light sum</span>
        <span className="text-right font-semibold">{num(row.par, 1, 'mol/m²')}</span>
        <span className="text-ink-2">PAR target</span>
        <span className="text-right font-semibold">{num(row.parTarget, 1, 'mol/m²')}</span>
        <span className="text-ink-2">LED lighting</span>
        <span className="text-right font-semibold">{num(row.ledHours, 1, 'hours')}</span>
      </div>
    </div>
  )
}

/** PAR light sum (line, with its target) next to the hours the LEDs were on (bars): how much of the light was bought. */
export function LightHoursCard({ rows, tickLabel }: { rows: LightHoursRow[]; tickLabel: (date: string) => string }) {
  const hasPar = rows.some((r) => r.par !== null)
  const hasLed = rows.some((r) => r.ledHours !== null)
  const hasParTarget = rows.some((r) => r.parTarget !== null)
  const left = axis(rows.flatMap((r) => [r.par, r.parTarget]))
  const right = axis(rows.map((r) => r.ledHours))
  const key: KeyItem[] = [
    ...(hasPar ? [{ label: 'PAR light sum (left axis)', kind: 'line' as const, color: ACTUAL }] : []),
    ...(hasParTarget ? [{ label: 'PAR target', kind: 'dashed' as const, color: TARGET }] : []),
    ...(hasLed ? [{ label: 'LED hours (right axis)', kind: 'bar' as const, color: LED_BAR }] : []),
  ]
  return (
    <ClimateCard title="PAR light and LED hours" note={`${kpiConfig(PAR).unit} of PAR inside the greenhouse (left) next to hours of ${LED_HOURS.toLowerCase()} (right).`}>
      {hasPar || hasLed ? (
        <PlotTile label="Chart over the days shown: the PAR light sum as a line with its target, and the hours of LED lighting as bars.">
          <div style={{ height: 190 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickLabel} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} interval="preserveStartEnd" minTickGap={18} />
                <YAxis yAxisId="p" domain={left.domain} ticks={left.ticks} allowDataOverflow width={36} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="h" orientation="right" domain={right.domain} ticks={right.ticks} allowDataOverflow width={36} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={false} />
                <Tooltip content={(props) => <Tip {...props} />} cursor={{ stroke: 'var(--color-ink-3)', strokeDasharray: '2 3' }} />
                <Bar yAxisId="h" dataKey="ledHours" fill={LED_BAR} fillOpacity={0.45} isAnimationActive={false} maxBarSize={18} />
                <Line yAxisId="p" dataKey="parTarget" type="monotone" stroke={TARGET} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="par" type="monotone" stroke={ACTUAL} strokeWidth={2} dot={rows.length > 31 ? false : { r: 3, fill: ACTUAL, stroke: 'var(--color-tile)', strokeWidth: 1.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </PlotTile>
      ) : (
        <EmptyPlot>No PAR light sum or LED hours were recorded on the days shown.</EmptyPlot>
      )}
      {key.length > 0 && <ChartKey items={key} />}
      {!hasPar && hasLed && <p className="text-xs text-ink-3">This cultivation has no PAR light sum in the data, so only the LED hours are shown.</p>}
    </ClimateCard>
  )
}
