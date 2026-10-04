import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { daySeries, readingDays, type ParameterDay } from '../../climate/day24'
import { formatDate } from '../../data/dates'
import { fixed } from '../../lib/format'
import type { ClimateReading } from '../../workspace/types'
import { ACTUAL, TARGET } from '../detail/KpiChart'
import { niceScale } from '../detail/chartData'
import { SECONDARY_BUTTON, SelectField } from '../ui/fields'
import { ChartKey } from './ChartKey'
import { ClimateCard, EmptyPlot } from './ClimateCard'

const HOUR_TICKS = [0, 4, 8, 12, 16, 20, 24]
const hourText = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

function ParameterChart({ item }: { item: ParameterDay }) {
  const finite = item.points.flatMap((p) => [p.value, p.setpoint]).filter((v): v is number => v !== null)
  const lo = Math.min(...finite)
  const hi = Math.max(...finite)
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.05 || 1
  const ticks = niceScale(lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad)
  const hasSetpoint = item.points.some((p) => p.setpoint !== null)
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-line-soft bg-tile p-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h4 className="text-sm font-semibold break-words">{item.parameter}</h4>
        <span className="num text-xs text-ink-3">{item.points.length} readings</span>
      </div>
      <div role="img" aria-label={`${item.parameter} over 24 hours, realised${hasSetpoint ? ' against setpoint' : ''}. ${item.points.length} readings.`} style={{ height: 150 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={item.points} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
            <XAxis dataKey="hour" type="number" domain={[0, 24]} ticks={HOUR_TICKS} tickFormatter={(h: number) => `${h}h`} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} />
            <YAxis domain={[ticks[0]!, ticks[ticks.length - 1]!]} ticks={ticks} allowDataOverflow width={44} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: 'var(--color-ink-3)', strokeDasharray: '2 3' }}
              content={({ active, payload }) => {
                const p = (payload?.[0] as { payload?: { hour: number; value: number; setpoint: number | null } } | undefined)?.payload
                if (!active || !p) return null
                return (
                  <div className="rounded-lg border border-line-strong bg-field p-2.5 text-sm shadow-md">
                    <div className="font-semibold">{hourText(p.hour)}</div>
                    <div className="num mt-1 grid grid-cols-[auto_auto] gap-x-3">
                      <span className="text-ink-2">Realised</span>
                      <span className="text-right font-semibold">{fixed(p.value, 2)}</span>
                      <span className="text-ink-2">Setpoint</span>
                      <span className="text-right font-semibold">{p.setpoint === null ? '–' : fixed(p.setpoint, 2)}</span>
                    </div>
                  </div>
                )
              }}
            />
            {hasSetpoint && <Line dataKey="setpoint" type="stepAfter" stroke={TARGET} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />}
            <Line dataKey="value" type="monotone" stroke={ACTUAL} strokeWidth={2} dot={item.points.length > 48 ? false : { r: 2.5, fill: ACTUAL, stroke: 'var(--color-tile)', strokeWidth: 1 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="num px-1 text-xs text-ink-3">{item.meanGap === null ? 'No setpoint in the file for this parameter.' : `Realised averaged ${fixed(Math.abs(item.meanGap), 2)} ${item.meanGap >= 0 ? 'above' : 'below'} the setpoint.`}</p>
    </div>
  )
}

/**
 * The finer data: one chosen day, 24 hours, realised against setpoint per parameter, from an imported climate computer export.
 * Without readings for the cultivation the card says this data is not connected yet.
 */
export function DayReadingsCard({
  cultivation,
  readings,
  preferDay,
  canWrite,
  onRemoveAll,
}: {
  cultivation: string
  readings: ClimateReading[]
  /** The day to open on when it has readings (the last day of the days shown). */
  preferDay: string | null
  canWrite: boolean
  onRemoveAll: (cultivation: string) => Promise<boolean>
}) {
  const days = useMemo(() => readingDays(readings, cultivation), [readings, cultivation])
  const [chosen, setChosen] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)
  const day = chosen && days.includes(chosen) ? chosen : preferDay && days.includes(preferDay) ? preferDay : (days[days.length - 1] ?? null)
  const series = useMemo(() => (day ? daySeries(readings, cultivation, day) : []), [readings, cultivation, day])
  const count = useMemo(() => readings.filter((r) => r.cultivation === cultivation).length, [readings, cultivation])

  if (days.length === 0 || !day) {
    return (
      <ClimateCard title="24 hours, realised against setpoint" note="Finer data from the climate computer.">
        <EmptyPlot>
          This data is not connected yet. The workbook holds daily values only. Import a climate computer export (timestamp, cultivation, parameter, value, setpoint) and each day with readings can be seen here hour by hour.
        </EmptyPlot>
        <Link to="/data/import/climate" className={`${SECONDARY_BUTTON} self-start`}>
          Import climate readings
        </Link>
      </ClimateCard>
    )
  }
  return (
    <ClimateCard title="24 hours, realised against setpoint" note={`${count.toLocaleString('en-US')} imported readings for ${cultivation}, ${days.length} ${days.length === 1 ? 'day' : 'days'}, ${formatDate(days[0]!)} to ${formatDate(days[days.length - 1]!)}.`}>
      <SelectField label="Day" value={day} onChange={setChosen} options={days.map((d) => ({ value: d, label: formatDate(d) }))} />
      <ChartKey
        items={[
          { label: 'Realised', kind: 'line', color: ACTUAL },
          { label: 'Setpoint', kind: 'dashed', color: TARGET },
        ]}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {series.map((item) => (
          <ParameterChart key={item.parameter} item={item} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/data/import/climate" className={SECONDARY_BUTTON}>
          Import more readings
        </Link>
        {!confirming ? (
          <button type="button" disabled={!canWrite} onClick={() => setConfirming(true)} className={SECONDARY_BUTTON}>
            Remove these readings
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void onRemoveAll(cultivation).then((ok) => { setConfirming(false); setRemoveFailed(!ok) })}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-bad-line bg-bad-bg px-4 text-sm font-semibold text-bad-ink"
            >
              Remove all {count.toLocaleString('en-US')} readings of {cultivation}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={SECONDARY_BUTTON}>
              Keep them
            </button>
          </>
        )}
      </div>
      {removeFailed && <p role="alert" className="text-sm font-semibold text-bad-ink">The readings could not be removed.</p>}
    </ClimateCard>
  )
}
