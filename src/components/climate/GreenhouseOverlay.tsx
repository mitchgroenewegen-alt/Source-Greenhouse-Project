import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cultivationName, overlaySeries, overlayShare, overlayShareAll, type OverlayDay } from '../../climate/peers'
import type { DayTable } from '../../climate/days'
import { CLIMATE_KPIS, RADIATION } from '../../climate/kpis'
import { formatDate } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import { fixed } from '../../lib/format'
import { kpiConfig } from '../../config/kpis'
import { ACTUAL } from '../detail/KpiChart'
import { niceScale } from '../detail/chartData'
import { FilterSelect } from '../ui/FilterSelect'
import { ChartKey } from './ChartKey'
import { ClimateCard, EmptyPlot, PlotTile } from './ClimateCard'

const OTHER = 'var(--color-other)'

/** A diamond mark, so the second crop differs from the first by shape and not only by colour. */
function DiamondDot(props: { cx?: number; cy?: number; index?: number }) {
  const { cx, cy } = props
  if (cx === undefined || cy === undefined) return <g key={props.index} />
  return <path key={props.index} d={`M${cx} ${cy - 4.5} L${cx + 4.5} ${cy} L${cx} ${cy + 4.5} L${cx - 4.5} ${cy} Z`} fill={OTHER} stroke="var(--color-tile)" strokeWidth={1.2} />
}

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))

/**
 * Two cultivations in the same greenhouse, one KPI, day by day. They share the air and the outside weather, so a gap on most
 * days is a question for whoever looks after the sensors and the climate computer: a sensor question or a data question.
 */
export function GreenhouseOverlay({
  own,
  peers,
  tables,
  dates,
  tickLabel,
}: {
  own: Cultivation
  peers: Cultivation[]
  /** Day tables by cultivation id, for this cultivation and each partner. */
  tables: ReadonlyMap<string, DayTable>
  dates: string[]
  tickLabel: (date: string) => string
}) {
  const [peerId, setPeerId] = useState(peers[0]!.id)
  const [kpi, setKpi] = useState<string>('Temperature (24h)')
  const peer = peers.find((p) => p.id === peerId) ?? peers[0]!
  const a = tables.get(own.id)!
  const b = tables.get(peer.id)!
  const config = kpiConfig(kpi)
  const rows = useMemo(() => overlaySeries(kpi, a, b, dates, (d) => d), [kpi, a, b, dates])
  const one = overlayShare(kpi, a, b, dates)
  const all = overlayShareAll(a, b, dates)
  const outside = overlayShare(RADIATION, a, b, dates)
  const axis = useMemo(() => {
    const finite = rows.flatMap((r) => [r.a, r.b]).filter((v): v is number => v !== null)
    const lo = finite.length ? Math.min(...finite) : 0
    const hi = finite.length ? Math.max(...finite) : 1
    const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1
    const ticks = niceScale(lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad)
    return { domain: [ticks[0]!, ticks[ticks.length - 1]!] as [number, number], ticks }
  }, [rows])
  const nameA = cultivationName(own)
  const nameB = cultivationName(peer)
  const green = config.variance === 'percent' ? `${config.green} %` : `${config.green} ${config.unit}`

  return (
    <ClimateCard
      headingLevel={3}
      title={`Same greenhouse: ${own.variety} and ${peer.variety}`}
      note={`${own.facility} ${own.greenhouse} holds both. They breathe the same air and see the same sun, so do their climates agree?`}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FilterSelect label="Climate KPI" value={kpi} onChange={setKpi} options={CLIMATE_KPIS.map((k) => ({ value: k.name, label: k.name }))} />
        {peers.length > 1 && <FilterSelect label="Compare with" value={peerId} onChange={setPeerId} options={peers.map((p) => ({ value: p.id, label: cultivationName(p) }))} />}
      </div>
      {one.compared > 0 ? (
        <PlotTile label={`Line chart over ${dates.length} days: ${config.name} for ${nameA} and for ${nameB}. ${one.different} of ${one.compared} days differ.`}>
          <div style={{ height: 200 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickLabel} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} interval="preserveStartEnd" minTickGap={18} />
                <YAxis domain={axis.domain} ticks={axis.ticks} allowDataOverflow width={44} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => String(Number(v.toFixed(Math.min(config.decimals + 1, 3))))} />
                <Tooltip
                  cursor={{ stroke: 'var(--color-ink-3)', strokeDasharray: '2 3' }}
                  content={({ active, payload }) => {
                    const row = (payload?.[0] as { payload?: OverlayDay } | undefined)?.payload
                    if (!active || !row) return null
                    return (
                      <div className="rounded-lg border border-line-strong bg-field p-2.5 text-sm shadow-md">
                        <div className="font-semibold">{formatDate(row.date)}</div>
                        <div className="num mt-1 grid grid-cols-[auto_auto] gap-x-3">
                          <span className="text-ink-2">{own.variety}</span>
                          <span className="text-right font-semibold">{row.a === null ? '–' : fixed(row.a, config.decimals)}</span>
                          <span className="text-ink-2">{peer.variety}</span>
                          <span className="text-right font-semibold">{row.b === null ? '–' : fixed(row.b, config.decimals)}</span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Line dataKey="b" name={nameB} type="monotone" stroke={OTHER} strokeWidth={2} dot={dates.length > 31 ? false : DiamondDot} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />
                <Line dataKey="a" name={nameA} type="monotone" stroke={ACTUAL} strokeWidth={2} dot={dates.length > 31 ? false : { r: 3, fill: ACTUAL, stroke: 'var(--color-tile)', strokeWidth: 1.5 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </PlotTile>
      ) : (
        <EmptyPlot>Not both cultivations have a value for {config.name} on the days shown.</EmptyPlot>
      )}
      <ChartKey
        items={[
          { label: nameA, kind: 'dot', color: ACTUAL },
          { label: nameB, kind: 'diamond', color: OTHER },
        ]}
      />
      <ul className="num flex flex-col gap-1 rounded-xl border border-line-soft bg-tile p-3 text-sm">
        <li>
          <span className="font-semibold">{config.name}:</span> the two differ on {one.different} of {one.compared} days, and by more than {green} on {one.beyondTolerance}.
        </li>
        <li>
          <span className="font-semibold">All climate KPIs:</span> they differ in {percent(all.different, all.compared)} % of the comparisons ({all.different} of {all.compared}); by more than the green tolerance in {percent(all.beyondTolerance, all.compared)} %.
        </li>
        {outside.compared > 0 && (
          <li>
            <span className="font-semibold">Solar radiation</span> is measured outside, so it should read the same for both: it differs on {outside.different} of {outside.compared} days.
          </li>
        )}
      </ul>
      <p className="text-sm">
        <span className="font-semibold">Is this the crops, a sensor or the data?</span> Different crops can be steered to different targets, but two readings of the same air that differ almost every day, even by small amounts, are worth asking about: check where the sensors hang, how each cultivation&apos;s numbers are taken from the climate computer, and whether they are copied from one zone to the other.
      </p>
    </ClimateCard>
  )
}
