import { useMemo } from 'react'
import { backtestAll, forecastAll, FORECAST, type Backtest, type CultivationForecast } from '../forecast'
import { useCropData } from './CropDataContext'

export interface Forecasts {
  /** The week the forecast starts after: the latest week with a recorded value. Undefined when nothing is recorded. */
  asOf: string | undefined
  /** By cultivation id. Cultivations with no recorded harvest are not in it. */
  byCultivation: ReadonlyMap<string, CultivationForecast>
  /** The backtest as of FORECAST.backtestAsOfWeek, or null when the data does not reach that week. */
  backtest: Backtest | null
}

/**
 * The forecasts of every cultivation, from the weekly values the scores use: the merged workbook (edits, entered and imported
 * days) with the data checks' decisions applied, and "Show raw data" respected.
 */
export function useForecasts(): Forecasts {
  const { weeks, cultivations, point, defaultWeek } = useCropData()
  return useMemo(() => {
    const weekIds = weeks.map((w) => w.id)
    const byCultivation = defaultWeek ? forecastAll(cultivations, defaultWeek, weekIds, point) : new Map()
    const backtestPossible = weekIds.includes(FORECAST.backtestAsOfWeek)
    const backtest = backtestPossible ? backtestAll(cultivations, FORECAST.backtestAsOfWeek, weekIds, point) : null
    return { asOf: defaultWeek, byCultivation, backtest }
  }, [weeks, cultivations, point, defaultWeek])
}
