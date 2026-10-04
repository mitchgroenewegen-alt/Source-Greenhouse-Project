import { useMemo, useState } from 'react'
import { config as kpi } from '../../climate/kpis'
import { dayLabel, dayTable, daysBetween, kpiSeries, periodOf, type DayTable } from '../../climate/days'
import { readingKey } from '../../climate/import'
import { sharedGreenhouse } from '../../climate/peers'
import { differenceSeries, lightHoursSeries, lightTemperatureSeries } from '../../climate/series'
import { CO2, DEFICIT, HUMIDITY, RTR, T_24H, T_DAY, T_DIFF, T_NIGHT } from '../../climate/kpis'
import { formatRange, shortWeek } from '../../data/dates'
import type { Cultivation } from '../../data/types'
import { useCropData } from '../../state/CropDataContext'
import { useView } from '../../state/ViewContext'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { Segmented } from '../ui/Segmented'
import { DailyKpiCard } from './DailyKpiCard'
import { DayReadingsCard } from './DayReadingsCard'
import { GreenhouseOverlay } from './GreenhouseOverlay'
import { LightHoursCard } from './LightHoursCard'
import { LightTemperatureCard } from './LightTemperatureCard'
import { OffTargetStrip } from './OffTargetStrip'
import { SectionTitle } from './ClimateCard'

type Range = 'week' | 'all'

const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2'

/**
 * The Climate tab's daily view: what a grower steers on, day by day, instead of the weekly scores. It reads the same days as the
 * scores (workspace edits and entries laid over the workbook, flagged values left out until decided, or the recorded values with
 * "Show raw data" on), for the picked week or the whole period.
 */
export function ClimateView({ cultivation }: { cultivation: Cultivation }) {
  const { effectiveDaily, cultivations, rawMode, canWrite } = useCropData()
  const { week, weekInfo } = useView()
  const workspace = useWorkspace()
  const [range, setRange] = useState<Range>('week')

  const peers = useMemo(() => sharedGreenhouse(cultivation.id, cultivations), [cultivation.id, cultivations])
  const tables = useMemo(() => {
    const map = new Map<string, DayTable>()
    for (const c of [cultivation, ...peers]) map.set(c.id, dayTable(effectiveDaily, c.id))
    return map
  }, [effectiveDaily, cultivation, peers])
  const table = tables.get(cultivation.id)!

  const period = useMemo(() => periodOf(table), [table])
  const weekDates = useMemo(() => daysBetween(weekInfo.start, weekInfo.end), [weekInfo])
  const dates = useMemo(() => (range === 'all' && period ? daysBetween(period.start, period.end) : weekDates), [range, period, weekDates])
  const weekday = dates.length <= 7
  const tickLabel = (date: string) => dayLabel(date, weekday)
  const highlight = range === 'all' && dates.length > 0 ? { from: weekDates[0]! < dates[0]! ? dates[0]! : weekDates[0]!, to: weekDates[6]! > dates[dates.length - 1]! ? dates[dates.length - 1]! : weekDates[6]! } : null

  const series = (name: string) => kpiSeries(table, name, dates, weekday)
  const diff = useMemo(() => differenceSeries(table, dates, weekday), [table, dates, weekday])
  const lightTemperature = useMemo(() => lightTemperatureSeries(table, dates, weekday), [table, dates, weekday])
  const lightHours = useMemo(() => lightHoursSeries(table, dates, weekday), [table, dates, weekday])
  const card = (name: string, points = series(name)) => <DailyKpiCard key={name} config={kpi(name)} points={points} highlight={highlight} tickLabel={tickLabel} />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-3">
        <Segmented<Range>
          label="Days shown"
          value={range}
          onChange={setRange}
          options={[
            { value: 'week', label: `${shortWeek(week)}, the picked week` },
            { value: 'all', label: 'Whole period' },
          ]}
        />
        <p className="text-xs text-ink-3">
          {dates.length > 0 ? `${formatRange(dates[0]!, dates[dates.length - 1]!)}, ${dates.length} days.` : 'No days.'} Daily values, with your edits and entries laid over the workbook
          {rawMode ? '; Show raw data is on, so flagged values count as recorded' : '; a value the data checks flagged is left out until it is decided'}.
        </p>
      </div>

      <OffTargetStrip table={table} dates={dates} picked={range === 'all' ? highlight : null} raw={rawMode} />

      <SectionTitle>Temperature</SectionTitle>
      <div className={GRID}>
        {card(T_24H)}
        {card(T_DAY)}
        {card(T_NIGHT)}
        {card(T_DIFF, diff)}
      </div>

      <SectionTitle>Light</SectionTitle>
      <div className={GRID}>
        <LightTemperatureCard rows={lightTemperature} tickLabel={tickLabel} />
        {card(RTR)}
        <LightHoursCard rows={lightHours} tickLabel={tickLabel} />
      </div>

      <SectionTitle>Humidity and CO₂</SectionTitle>
      <div className={GRID}>
        {card(HUMIDITY)}
        {card(DEFICIT)}
        {card(CO2)}
      </div>

      {peers.length > 0 && (
        <>
          <SectionTitle>Same greenhouse</SectionTitle>
          <GreenhouseOverlay own={cultivation} peers={peers} tables={tables} dates={dates} tickLabel={tickLabel} />
        </>
      )}

      <SectionTitle>Hour by hour</SectionTitle>
      <DayReadingsCard
        cultivation={cultivation.id}
        readings={workspace.data.climateReadings}
        preferDay={dates[dates.length - 1] ?? null}
        canWrite={canWrite}
        onRemoveAll={(id) => workspace.remove('climateReadings', workspace.data.climateReadings.filter((r) => r.cultivation === id).map(readingKey))}
      />
    </div>
  )
}
