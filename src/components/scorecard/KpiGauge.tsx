import { planWord, type KpiConfig } from '../../config/kpis'
import { formatValue } from '../../lib/kpiFormat'
import type { Status } from '../../scoring/score'
import { AlertIcon } from '../ui/icons'
import { arcPath, arcPoint, gaugeValueText, type GaugeModel } from './gauge'

// The meter is drawn in its own pixel units (one SVG unit is one CSS pixel at the narrowest tile, 320 px phones), so
// the small text never shrinks. It never grows past 112 px wide (stacked or beside the figures), so the Waste tile
// stays close to the height of its neighbours; the one narrower size (96 px) is for a tile with about 190-220 px of room.
const WIDTH = 104
const HEIGHT = 56
const CX = WIDTH / 2
const CY = 43
const RADIUS = 38
const STROKE = 9

/** The status colour of the arc, the same tokens as the badge. A tile with no status gets a neutral arc. */
const FILL: Record<Status | 'none', string> = {
  green: 'stroke-ok',
  amber: 'stroke-warn',
  red: 'stroke-bad',
  none: 'stroke-ink-3',
}

/** The unit written the short way: "9.1%", "1.25 kg/m²". */
function shortValue(config: KpiConfig, value: number): string {
  const text = formatValue(config, value)
  return config.unit === '%' ? `${text}%` : `${text} ${config.unit}`
}

/** Which way the budget label reads from the tick, so it stays inside the arc whatever the scale is. */
function labelAnchor(budgetFraction: number): 'start' | 'middle' | 'end' {
  if (budgetFraction < 0.35) return 'start'
  return budgetFraction > 0.65 ? 'end' : 'middle'
}

/**
 * A compact semicircular meter: the arc fills from 0 to the actual in the tile's status colour, a tick marks the
 * budget, and the scale ends at `rangeOfBudget` x the budget (see `gauge` in src/config/kpis.ts). An actual beyond the
 * end of the scale fills the arc and puts a stop bar at its end (the words are OverScaleNote, next to it); nothing is
 * drawn past the arc.
 */
export function KpiGauge({ config, model, status }: { config: KpiConfig; model: GaugeModel; status: Status | null }) {
  const plan = planWord(config)
  const inner = RADIUS - STROKE / 2
  const outer = RADIUS + STROKE / 2

  const tickFrom = arcPoint(CX, CY, inner - 3, model.budgetFraction)
  const tickTo = arcPoint(CX, CY, outer + 3, model.budgetFraction)
  const labelAt = arcPoint(CX, CY, inner - 10, model.budgetFraction)
  const anchor = labelAnchor(model.budgetFraction)
  const stopFrom = arcPoint(CX, CY, inner - 1, 1)
  const stopTo = arcPoint(CX, CY, outer + 1, 1)

  return (
    <div
      role="meter"
      aria-label={`${config.name} against ${plan}`}
      aria-valuemin={0}
      aria-valuemax={Number(model.scaleMax.toFixed(4))}
      aria-valuenow={Number(model.clampedActual.toFixed(4))}
      aria-valuetext={gaugeValueText(model, (v) => shortValue(config, v), plan)}
      className="w-full max-w-28 @[12rem]:w-24 @[12rem]:shrink-0 @[14rem]:w-28"
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" aria-hidden="true" focusable="false">
        <path d={arcPath(CX, CY, RADIUS, 0, 1)} fill="none" className="stroke-track" strokeWidth={STROKE} />
        {model.fraction > 0 && <path d={arcPath(CX, CY, RADIUS, 0, model.fraction)} fill="none" className={FILL[status ?? 'none']} strokeWidth={STROKE} />}
        {model.over && (
          // The stop bar sits at the very end of the arc: the arc is full and the value went on.
          <line x1={stopFrom.x} y1={stopFrom.y - 2} x2={stopTo.x} y2={stopTo.y - 2} className="stroke-ink" strokeWidth={3} />
        )}
        {/* The budget tick: a light halo under a dark line, so it shows on the coloured fill as well as on the track. */}
        <line x1={tickFrom.x} y1={tickFrom.y} x2={tickTo.x} y2={tickTo.y} className="stroke-tile" strokeWidth={5} />
        <line x1={tickFrom.x} y1={tickFrom.y} x2={tickTo.x} y2={tickTo.y} className="stroke-ink" strokeWidth={2} />
        {/* The label is the budget value, inside the arc beside the tick; the "Budget" word is on the line below the meter. */}
        <text x={labelAt.x} y={labelAt.y + 4} textAnchor={anchor} className="fill-ink" fontSize={11} fontWeight={700}>
          {formatValue(config, model.budget)}
        </text>
        <text x={CX - RADIUS} y={HEIGHT - 1} textAnchor="middle" className="fill-ink-2" fontSize={10}>
          0
        </text>
        <text x={CX + RADIUS} y={HEIGHT - 1} textAnchor="middle" className="fill-ink-2" fontSize={10}>
          {formatValue(config, model.scaleMax)}
        </text>
      </svg>
    </div>
  )
}

/** The words that go with the stop bar when the actual is beyond the scale: "Over scale: 9.1% vs 4.8% max". */
export function OverScaleNote({ config, model, className = '' }: { config: KpiConfig; model: GaugeModel; className?: string }) {
  return (
    <p className={`num flex items-start gap-1 text-[0.68rem] font-semibold leading-tight text-ink ${className}`}>
      <AlertIcon width={12} height={12} className="mt-px shrink-0" />
      <span>
        Over scale: {shortValue(config, model.actual)} vs {shortValue(config, model.scaleMax)} max
      </span>
    </p>
  )
}
