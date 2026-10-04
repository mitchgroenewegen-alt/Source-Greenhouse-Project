// The numbers behind the Climate tab's combined charts: the day/night difference, the temperature the RTR target asks for,
// and PAR next to LED hours. Pure; the charts only draw what comes out of here.

import { round } from '../data/aggregate'
import { dayLabel, kpiSeries, pointOf, type DayCell, type DayPoint, type DayTable } from './days'
import { LED_HOURS, PAR, RADIATION, RTR, T_24H, T_DAY, T_DIFF, T_NIGHT } from './kpis'

const cellOf = (table: DayTable, kpi: string, date: string): DayCell | undefined => table.get(kpi)?.get(date)

/**
 * Day temperature minus night temperature, per day. The workbook has this as its own KPI; where that KPI has no value for
 * a day (for example the day or the night reading is missing, so it has none either) and both temperatures are there, it is
 * worked out from them, so the chart and the two temperature charts above it always agree. The same for the target.
 * The flag marks follow the recorded KPI, plus those of the two temperatures when a value is worked out from them.
 */
export function differenceSeries(table: DayTable, dates: readonly string[], weekday: boolean): DayPoint[] {
  return dates.map((date) => {
    const recorded = pointOf(cellOf(table, T_DIFF, date), date, weekday)
    const day = cellOf(table, T_DAY, date)
    const night = cellOf(table, T_NIGHT, date)
    const derive = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? round(a - b, 2) : null)
    const actual = recorded.actual ?? derive(day?.actual, night?.actual)
    const target = recorded.target ?? derive(day?.target, night?.target)
    const derived = actual !== recorded.actual || target !== recorded.target
    const dayPoint = pointOf(day, date, weekday)
    const nightPoint = pointOf(night, date, weekday)
    return {
      ...recorded,
      actual,
      target,
      openFlags: recorded.openFlags + (derived ? dayPoint.openFlags + nightPoint.openFlags : 0),
      decidedFlags: recorded.decidedFlags + (derived ? dayPoint.decidedFlags + nightPoint.decidedFlags : 0),
    }
  })
}

/**
 * The temperature the RTR target stands for on a day. The workbook defines RTR as the 24-hour temperature divided by the
 * day's solar radiation sum (°C per J/cm²), so a target ratio times the radiation is the 24-hour temperature that would
 * hit the target on that day. Nothing is invented: the line needs both the RTR target and the radiation of the day, and is
 * left empty without either.
 */
export function rtrTemperature(rtrTarget: number | null, radiation: number | null): number | null {
  return rtrTarget === null || radiation === null ? null : round(rtrTarget * radiation, 2)
}

export interface LightTemperatureRow {
  date: string
  label: string
  /** The 24-hour average temperature. */
  temperature: number | null
  /** The 24-hour temperature target of the day (the one the Temperature (24h) KPI is scored against). */
  temperatureTarget: number | null
  /** Solar radiation outside, J/cm². */
  radiation: number | null
  rtrActual: number | null
  rtrTarget: number | null
  /** RTR target × radiation. */
  rtrTemperature: number | null
  flagged: boolean
}

export function lightTemperatureSeries(table: DayTable, dates: readonly string[], weekday: boolean): LightTemperatureRow[] {
  return dates.map((date) => {
    const t = cellOf(table, T_24H, date)
    const r = cellOf(table, RTR, date)
    const s = cellOf(table, RADIATION, date)
    const rtrTarget = r?.target ?? null
    const radiation = s?.actual ?? null
    const open = [t, r, s].some((c) => c && (c.actualState === 'open' || c.targetState === 'open'))
    return {
      date,
      label: dayLabel(date, weekday),
      temperature: t?.actual ?? null,
      temperatureTarget: t?.target ?? null,
      radiation,
      rtrActual: r?.actual ?? null,
      rtrTarget,
      rtrTemperature: rtrTemperature(rtrTarget, radiation),
      flagged: open,
    }
  })
}

export interface LightHoursRow {
  date: string
  label: string
  par: number | null
  parTarget: number | null
  ledHours: number | null
  ledBudget: number | null
}

/** PAR light sum (mol/m²) next to the hours of LED light of the same day. */
export function lightHoursSeries(table: DayTable, dates: readonly string[], weekday: boolean): LightHoursRow[] {
  const par = kpiSeries(table, PAR, dates, weekday)
  const led = kpiSeries(table, LED_HOURS, dates, weekday)
  return dates.map((date, i) => ({
    date,
    label: par[i]!.label,
    par: par[i]!.actual,
    parTarget: par[i]!.target,
    ledHours: led[i]!.actual,
    ledBudget: led[i]!.target,
  }))
}
