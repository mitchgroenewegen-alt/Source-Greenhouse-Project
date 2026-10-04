import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { BacktestTable } from '../components/forecast/BacktestTable'
import { ForecastTable } from '../components/forecast/ForecastTable'
import { addDays, formatRange, shortWeek, weekStartOf } from '../data/dates'
import { FORECAST, forecastWeekIds } from '../forecast'
import { useCropData } from '../state/CropDataContext'
import { useForecasts } from '../state/useForecasts'

export default function ForecastScreen() {
  const { visibleCultivations } = useCropData()
  const { asOf, byCultivation, backtest } = useForecasts()
  const { hash } = useLocation()

  // The links to "How good is this?" land on that heading (the app uses hash routes, so the anchor is the second part of the hash).
  useEffect(() => {
    if (hash === '#how-good') document.getElementById('how-good')?.scrollIntoView({ block: 'start' })
  }, [hash, backtest])

  if (!asOf) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Forecast</h1>
        <p>Nothing is recorded yet, so there is nothing to forecast from.</p>
      </div>
    )
  }

  const weeks = forecastWeekIds(asOf)
  const rows = visibleCultivations.map((cultivation) => ({ cultivation, forecast: byCultivation.get(cultivation.id) }))
  const withoutSeasonEnd = rows.filter((r) => r.forecast && !r.forecast.seasonEnd)
  const withSeasonEnd = rows.filter((r) => r.forecast?.seasonEnd)

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">Forecast</h1>
        <p>
          Expected harvest in kg/m² for the next {FORECAST.horizonWeeks} weeks, {shortWeek(weeks[0]!)} to {shortWeek(weeks[weeks.length - 1]!)} (
          {formatRange(weekStartOf(weeks[0]!), addDays(weekStartOf(weeks[weeks.length - 1]!), 6))}), made from the data up to {shortWeek(asOf)}.
        </p>
      </div>

      <ForecastTable rows={rows} />

      <section aria-label="How the forecast is made" className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2 shadow-sm">
        <h2 className="text-base font-semibold text-ink">How it is made</h2>
        <p className="mt-1">
          Fruit set in a week is harvested about one fruit development time later (5 to 8 weeks in this data). The harvest expected in a week is the fruit set of that earlier week × the fruit weight ÷ 1000, which is kg/m² a week, the same unit as Harvest.
          That estimate is then multiplied by a correction factor: the actual harvest over the estimate across the last {FORECAST.calibrationWeeks} weeks. The range is the lowest and highest of those weeks.
        </p>
        <p className="mt-2">
          With fewer than {FORECAST.calibrationWeeks} comparable weeks there is too little to correct by, so the estimate is shown as it is, with a range of ×{FORECAST.uncorrectedRange.low} to ×{FORECAST.uncorrectedRange.high}, and labelled Uncorrected.
          Where the fruit set of a week is not recorded yet, the latest weeks' average is used.
        </p>
      </section>

      <section aria-label="Season end" className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-2 shadow-sm">
        <h2 className="text-base font-semibold text-ink">Season end</h2>
        {withSeasonEnd.length === 0 ? (
          <p className="mt-1">
            There is no season-end forecast, only the six weeks above. {withoutSeasonEnd[0]?.forecast?.seasonEndNote ?? 'It needs a Harvest budget for the weeks after the last data week.'} The workbook's Harvest budget stops at its last week.
          </p>
        ) : (
          <>
            <p className="mt-1">Harvest to date + the six weeks + the remaining budget × how the last {FORECAST.calibrationWeeks} weeks went against their budget.</p>
            <ul className="num mt-2 flex flex-col gap-1">
              {withSeasonEnd.map(({ cultivation, forecast }) => (
                <li key={cultivation.id}>
                  <span className="font-semibold text-ink">{cultivation.id}</span>: {forecast!.seasonEnd!.expected.toFixed(1)} kg/m² (budget runs to {shortWeek(forecast!.seasonEnd!.budgetEndsWeek)})
                </li>
              ))}
            </ul>
            {withoutSeasonEnd.length > 0 && <p className="mt-2">No season end for {withoutSeasonEnd.map((r) => r.cultivation.id).join(', ')}: {withoutSeasonEnd[0]!.forecast!.seasonEndNote}</p>}
          </>
        )}
      </section>

      <section aria-labelledby="how-good" className="flex flex-col gap-3">
        <div>
          <h2 id="how-good" className="scroll-mt-20 text-xl font-semibold">
            How good is this?
          </h2>
          {backtest ? (
            <p>
              The forecast rerun as if it were {shortWeek(backtest.asOf)}, using only what was recorded up to then, against the real harvest in {shortWeek(backtest.from)} to {shortWeek(backtest.to)}. The error is the average of each week's miss in percent of what was harvested (weeks with almost nothing harvested are left out).
            </p>
          ) : (
            <p>The check needs data up to {shortWeek(FORECAST.backtestAsOfWeek)}, which this data does not have.</p>
          )}
        </div>
        {backtest && backtest.results.length > 0 && <BacktestTable backtest={backtest} />}
        {backtest && backtest.results.some((r) => r.method === 'uncorrected') && (
          <p className="text-sm">
            Every forecast here is the uncorrected estimate: the fruit set the estimate needs goes back 5 to 8 weeks and the data starts only a few weeks before that, so by {shortWeek(backtest.asOf)} no cultivation has {FORECAST.calibrationWeeks} weeks to compare. The live forecast above has them and is corrected where it can be.
          </p>
        )}
      </section>
    </div>
  )
}
