import type { ReactElement } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { planWord, type KpiConfig } from '../../config/kpis'
import { shortWeek } from '../../data/dates'
import type { WeekInfo } from '../../data/types'
import { formatValue, formatVariance } from '../../lib/kpiFormat'
import type { FlagMark } from '../../scoring/effective'
import { scoreWith, STATUS_LABEL } from '../../scoring/score'
import { BANDS, type Band } from './chartBands'
import type { ChartModel, ChartRow } from './chartData'

export const ACTUAL = 'var(--color-actual)'
export const TARGET = 'var(--color-target)'
const ORIGINAL = 'var(--color-ink-3)'
export const FLAG = 'var(--color-flag)'
const FORECAST_COLOR = 'var(--color-actual)'

/** A point on a line; a violet ring goes round it when the week holds a flagged value of that column. */
export function markedDot<R>(color: string, markOf: (row: R) => FlagMark) {
  return function Dot(props: { cx?: number; cy?: number; payload?: R; index?: number }): ReactElement {
    const { cx, cy, payload } = props
    if (cx === undefined || cy === undefined || !payload) return <g key={props.index} />
    const mark = markOf(payload)
    return (
      <g key={props.index}>
        <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="var(--color-tile)" strokeWidth={1.5} />
        {mark && (
          <circle
            cx={cx}
            cy={cy}
            r={8}
            fill="none"
            stroke={FLAG}
            strokeWidth={mark === 'open' ? 2.5 : 1.5}
            strokeDasharray={mark === 'open' ? undefined : '3 2'}
          />
        )}
      </g>
    )
  }
}

/** The violet flag at the top of the plot for a week that holds a flagged value, even when the value itself is left out. */
export function FlagMarker(props: { cx?: number; cy?: number; payload?: { flagY: number | null; openFlags: number }; index?: number }): ReactElement {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined || !payload || payload.flagY === null) return <g key={props.index} />
  const open = payload.openFlags > 0
  return (
    <g key={props.index} transform={`translate(${cx} ${cy + 7})`}>
      <path d="M0 -6 L6 5 L-6 5 Z" fill={open ? FLAG : 'var(--color-tile)'} stroke={FLAG} strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  )
}

function ChartTooltip({
  active,
  payload,
  config,
  weeks,
}: {
  active?: boolean
  payload?: readonly { payload?: ChartRow }[]
  config: KpiConfig
  weeks: WeekInfo[]
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const info = weeks.find((w) => w.id === row.week)
  const score = scoreWith(config, row.actual, row.target)
  return (
    <div className="rounded-lg border border-line-strong bg-field p-2.5 text-sm shadow-md">
      <div className="font-semibold">
        {shortWeek(row.week)} <span className="font-normal text-ink-3">{info ? `${info.start} to ${info.end}` : ''}</span>
      </div>
      {row.isForecast ? (
        <div className="num mt-1 grid grid-cols-[auto_auto] gap-x-3">
          <span className="text-ink-2">Forecast</span>
          <span className="text-right font-semibold">{formatValue(config, row.forecast)}</span>
          <span className="text-ink-2">Range</span>
          <span className="text-right font-semibold">
            {formatValue(config, row.forecastBand?.[0] ?? null)} to {formatValue(config, row.forecastBand?.[1] ?? null)}
          </span>
        </div>
      ) : (
      <div className="num mt-1 grid grid-cols-[auto_auto] gap-x-3">
        <span className="text-ink-2">Actual</span>
        <span className="text-right font-semibold">{formatValue(config, row.actual)}</span>
        <span className="text-ink-2">{planWord(config, { capitalised: true })}</span>
        <span className="text-right font-semibold">{formatValue(config, row.target)}</span>
        {row.edited && (
          <>
            <span className="text-ink-2">Original {planWord(config)}</span>
            <span className="text-right font-semibold">{formatValue(config, row.originalTarget)}</span>
          </>
        )}
        {score.variance !== null && (
          <>
            <span className="text-ink-2">Difference</span>
            <span className="text-right font-semibold">{formatVariance(config, score.variance)}</span>
          </>
        )}
      </div>
      )}
      {!row.isForecast && score.status && <div className="mt-1 text-xs font-semibold">{STATUS_LABEL[score.status]}</div>}
      {row.openFlags > 0 && <div className="mt-1 text-xs font-semibold text-flag-ink">{row.openFlags} flagged value(s) left out, waiting for a decision</div>}
      {row.decidedFlags > 0 && <div className="mt-1 text-xs text-flag-ink">{row.decidedFlags} flagged value(s) checked by a person</div>}
    </div>
  )
}

export function KpiChart({
  config,
  model,
  weeks,
  selectedWeek,
  height = 190,
}: {
  config: KpiConfig
  model: ChartModel
  weeks: WeekInfo[]
  selectedWeek: string
  height?: number
}) {
  const decimals = config.decimals
  const selectedLabel = shortWeek(selectedWeek)
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={model.rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            interval="preserveStartEnd"
            minTickGap={14}
          />
          <YAxis
            domain={model.domain}
            ticks={model.ticks}
            allowDataOverflow
            width={44}
            tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (Math.abs(v) >= 10000 ? `${Math.round(v / 100) / 10}k` : String(Number(v.toFixed(Math.min(decimals + 1, 3)))))}
          />
          <Tooltip content={(props) => <ChartTooltip {...props} config={config} weeks={weeks} />} cursor={{ stroke: 'var(--color-ink-3)', strokeDasharray: '2 3' }} />
          <ReferenceLine x={selectedLabel} stroke="var(--color-brand)" strokeOpacity={0.16} strokeWidth={14} />
          <Area dataKey="amber" type="monotone" stroke="none" fill={BANDS.watch.fill} fillOpacity={BANDS.watch.opacity} isAnimationActive={false} activeDot={false} legendType="none" />
          <Area dataKey="amberAbove" type="monotone" stroke="none" fill={BANDS.watch.fill} fillOpacity={BANDS.watch.opacity} isAnimationActive={false} activeDot={false} legendType="none" />
          <Area dataKey="green" type="monotone" stroke="none" fill={BANDS.onTrack.fill} fillOpacity={BANDS.onTrack.opacity} isAnimationActive={false} activeDot={false} legendType="none" />
          {model.hasForecast && <Area dataKey="forecastBand" type="monotone" stroke="none" fill={FORECAST_COLOR} fillOpacity={0.18} isAnimationActive={false} activeDot={false} legendType="none" />}
          {model.hasEdits && <Line dataKey="originalTarget" type="monotone" stroke={ORIGINAL} strokeWidth={1.5} strokeDasharray="2 3" dot={false} activeDot={false} isAnimationActive={false} />}
          <Line dataKey="target" type="monotone" stroke={TARGET} strokeWidth={2} strokeDasharray="5 4" dot={markedDot(TARGET, (r) => r.targetMark)} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line dataKey="actual" type="monotone" stroke={ACTUAL} strokeWidth={2} dot={markedDot(ACTUAL, (r) => r.actualMark)} activeDot={{ r: 5 }} isAnimationActive={false} />
          {model.hasForecast && <Line dataKey="forecast" type="monotone" stroke={FORECAST_COLOR} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
          <Line dataKey="flagY" stroke="none" dot={FlagMarker} activeDot={false} isAnimationActive={false} legendType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A legend swatch for a band: the band's fill over a tile-coloured underlay, so it comes out the same colour as in the chart. */
function BandSwatch({ band }: { band: Band }) {
  return (
    <svg width="16" height="12" aria-hidden="true">
      <rect x="0.5" y="0.5" width="15" height="11" rx="2" fill="var(--color-tile)" />
      <rect x="0.5" y="0.5" width="15" height="11" rx="2" fill={band.fill} fillOpacity={band.opacity} stroke={band.edge} strokeOpacity={0.6} />
    </svg>
  )
}

/** What the lines and shading mean. Plain HTML so it reads the same everywhere. */
/** `planLabel` is the KPI's plan word, capitalised: "Budget" or "Target". With `hasEdits` the legend adds "Original budget" or "Original target". */
export function ChartLegend({ hasTarget, hasFlags, hasEdits = false, hasForecast = false, planLabel }: { hasTarget: boolean; hasFlags: boolean; hasEdits?: boolean; hasForecast?: boolean; planLabel: string }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chart key">
      <li className="flex items-center gap-1.5">
        <svg width="22" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="22" y2="4" stroke={ACTUAL} strokeWidth="2.5" />
        </svg>
        Actual
      </li>
      {hasTarget && (
        <>
          <li className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" stroke={TARGET} strokeWidth="2.5" strokeDasharray="5 3" />
            </svg>
            {planLabel}
          </li>
          {hasEdits && (
            <li className="flex items-center gap-1.5">
              <svg width="22" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="22" y2="4" stroke={ORIGINAL} strokeWidth="2" strokeDasharray="2 3" />
              </svg>
              Original {planLabel.toLowerCase()}
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <BandSwatch band={BANDS.onTrack} />
            On track
          </li>
          <li className="flex items-center gap-1.5">
            <BandSwatch band={BANDS.watch} />
            Watch
          </li>
        </>
      )}
      {hasForecast && (
        <li className="flex items-center gap-1.5">
          <svg width="22" height="10" aria-hidden="true">
            <rect x="0" y="0" width="22" height="10" rx="2" fill={FORECAST_COLOR} fillOpacity="0.18" />
            <line x1="0" y1="5" x2="22" y2="5" stroke={FORECAST_COLOR} strokeWidth="2.5" strokeDasharray="2 4" strokeLinecap="round" />
          </svg>
          Forecast and its range
        </li>
      )}
      {hasFlags && (
        <li className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
            <path d="M0 -6 L6 5 L-6 5 Z" fill={FLAG} stroke={FLAG} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          Flagged value (filled: open, hollow: checked)
        </li>
      )}
    </ul>
  )
}
