import { planWordForAll } from '../../config/kpis'
import { dayLabel, type DayTable } from '../../climate/days'
import { CLIMATE_KPIS } from '../../climate/kpis'
import { countKinds, DAY_KIND_LABEL, dayVerdict, type DayKind, type DayVerdict } from '../../climate/status'
import { formatDate } from '../../data/dates'
import { AlertIcon, CheckIcon, CrossIcon, DashIcon, FlagIcon } from '../ui/icons'
import { ClimateCard } from './ClimateCard'

// The same tints as the week-by-week table (src/components/detail/WeeklyTable.tsx); flagged is the data-check violet.
const CELL: Record<DayKind, string> = {
  green: 'bg-ok-bg text-ok',
  amber: 'bg-warn-bg/70 text-warn',
  red: 'bg-bad-bg/70 text-bad',
  flagged: 'bg-flag-bg text-flag-ink border border-flag',
  none: 'bg-tile text-ink-3 border border-dashed border-line-strong',
}
const GLYPH = { green: CheckIcon, amber: AlertIcon, red: CrossIcon, flagged: FlagIcon, none: DashIcon }

/** One day of one KPI: a tinted cell with a glyph (never colour alone). A violet dot in the corner: a person has decided about a flagged value of the day. */
function DayCellMark({ kind, checked, size, label }: { kind: DayKind; checked: boolean; size: number; label: string }) {
  const Glyph = GLYPH[kind]
  return (
    <span role="img" aria-label={label} title={label} style={{ width: size, height: size }} className={`relative inline-flex items-center justify-center rounded-md ${CELL[kind]}`}>
      <Glyph width={size > 20 ? 14 : 10} height={size > 20 ? 14 : 10} aria-hidden="true" />
      {checked && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-tile bg-flag" />}
    </span>
  )
}

const LEGEND: { kind: DayKind; text: string; checked?: boolean }[] = [
  { kind: 'green', text: 'On track' },
  { kind: 'amber', text: 'Watch' },
  { kind: 'red', text: 'Off target' },
  { kind: 'flagged', text: 'Flagged by the data checks, not decided yet: not scored' },
  { kind: 'none', text: 'No value, or no target' },
  { kind: 'green', text: 'Violet dot: a flagged value of that day was checked by a person', checked: true },
]

function verdictText(kpi: string, date: string, v: DayVerdict) {
  return `${kpi}, ${formatDate(date)}: ${DAY_KIND_LABEL[v.kind]}${v.reason ? `, ${v.reason}` : ''}`
}

/**
 * Days off target: one row per climate KPI, one cell per day, coloured by the day's status (the KPI's tolerances, as for the
 * weeks). A day whose value or target is flagged by the data checks shows as flagged, not red, until somebody decides.
 * The strip scrolls sideways inside its card; the KPI names stay in view.
 */
export function OffTargetStrip({ table, dates, picked, raw }: { table: DayTable; dates: string[]; picked: { from: string; to: string } | null; raw: boolean }) {
  const weekView = dates.length <= 7
  const size = weekView ? 28 : 18
  const inPicked = (d: string) => picked !== null && d >= picked.from && d <= picked.to
  const rows = CLIMATE_KPIS.map((config) => {
    const verdicts = dates.map((date) => dayVerdict(config.name, table.get(config.name)?.get(date), { raw }))
    return { config, verdicts, counts: countKinds(verdicts) }
  })
  return (
    <ClimateCard
      title="Days off target"
      note={`One cell per day and climate KPI, against its ${planWordForAll(CLIMATE_KPIS)}. Scrolls sideways when the days do not fit.`}
    >
      <div className="relative overflow-x-auto rounded-xl border border-line-soft bg-tile" tabIndex={0} role="region" aria-label="Days off target, scrolls sideways">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-28 min-w-28 bg-tile px-2 py-1.5 text-left font-semibold text-ink-2 shadow-[1px_0_0_var(--color-line-soft)]">
                KPI
              </th>
              {dates.map((date, i) => (
                <th key={date} scope="col" className={`px-0.5 py-1.5 text-center font-semibold ${inPicked(date) && !weekView ? 'bg-brand-soft text-brand' : 'text-ink-2'}`}>
                  <span className="sr-only">{formatDate(date)}</span>
                  <span aria-hidden="true" className="num inline-block" style={{ minWidth: size }}>
                    {weekView ? dayLabel(date, true) : date.slice(8) === '01' || i === 0 ? dayLabel(date, false) : date.slice(8)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ config, verdicts, counts }) => (
              <tr key={config.name} className="border-t border-line-soft">
                  <th scope="row" className="sticky left-0 z-10 w-28 min-w-28 bg-tile px-2 py-1 text-left align-middle font-semibold shadow-[1px_0_0_var(--color-line-soft)]">
                    <span className="block leading-tight">{config.name}</span>
                    <span className="num block text-[0.68rem] font-normal text-ink-3">
                      {counts.red} off target{counts.flagged > 0 ? `, ${counts.flagged} flagged` : ''}
                    </span>
                  </th>
                  {dates.map((date, i) => {
                    const v = verdicts[i]!
                    return (
                      <td key={date} className="px-0.5 py-1 text-center">
                        <DayCellMark kind={v.kind} checked={(v.checked && v.kind !== 'none') || (raw && v.open)} size={size} label={verdictText(config.name, date, v)} />
                      </td>
                    )
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-1 text-xs text-ink-2" aria-label="Strip key">
        {LEGEND.map((item) => (
          <li key={item.text} className="flex items-center gap-2">
            <DayCellMark kind={item.kind} checked={item.checked ?? false} size={18} label={DAY_KIND_LABEL[item.kind]} />
            {item.text}
          </li>
        ))}
      </ul>
      {raw && <p className="text-xs text-ink-3">Show raw data is on: days with a flagged value are scored from the value as recorded, and carry the violet dot.</p>}
    </ClimateCard>
  )
}
