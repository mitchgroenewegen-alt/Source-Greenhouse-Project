import { useState } from 'react'
import { CultivationMoneyCard } from '../components/financials/CultivationMoneyCard'
import { ExamplePricesBanner } from '../components/financials/ExamplePricesBanner'
import { FinancialsSummaryTable } from '../components/financials/FinancialsSummaryTable'
import { ExportViewButton } from '../components/exchange/ExportViewButton'
import { Segmented } from '../components/ui/Segmented'
import { formatRange, shortWeek } from '../data/dates'
import { financialsViewSheet, viewFilePart } from '../exchange/viewSheets'
import { moneyText, signedMoney } from '../financials'
import { useFinancials } from '../state/useFinancials'
import { useCropData } from '../state/CropDataContext'
import { useView } from '../state/ViewContext'

type Period = 'week' | 'toDate'

export default function FinancialsScreen() {
  const { week, weekInfo } = useView()
  const { weeks } = useCropData()
  const financials = useFinancials()
  const [period, setPeriod] = useState<Period>('week')
  const first = weeks[0]!.id
  const periodLabel = period === 'week' ? shortWeek(week) : `${shortWeek(first)} to ${shortWeek(week)}`
  const rows = financials.all ? [...financials.facilities, financials.all] : financials.facilities
  const currency = financials.all?.currency ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Financials</h1>
          <p>
            Revenue, energy and water cost and partial margin against budget. {shortWeek(week)}, {formatRange(weekInfo.start, weekInfo.end)}.
          </p>
        </div>
        <ExportViewButton filePart={viewFilePart('financials', weekInfo)} build={() => [financialsViewSheet(financials, weekInfo, weeks[0]!.id)]} />
      </div>

      <ExamplePricesBanner examplePrices={financials.examplePrices} exampleRatesFor={financials.exampleRatesFor} placeholderLed={financials.placeholderLed} />

      <div className="rounded-2xl border border-line bg-card p-3">
        <Segmented
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: `${shortWeek(week)} only` },
            { value: 'toDate', label: `Since ${shortWeek(first)} (start of the data)` },
          ]}
        />
      </div>

      <FinancialsSummaryTable rows={rows} period={period} periodLabel={periodLabel} currency={currency} />
      {financials.all === null && <p className="text-sm">The facilities use different currencies, so there is no total for all of them.</p>}

      {financials.facilities.map((facility) => {
        const p = facility[period]
        return (
          <section key={facility.label} id={facility.cardId ?? undefined} tabIndex={-1} aria-labelledby={`fin-${facility.label}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`fin-${facility.label}`} className="text-xl font-semibold">{facility.label}</h2>
              <p className="num text-sm">
                Margin {moneyText(p.margin.actual, facility.currency)}
                {p.effects && <> · gap to budget {signedMoney(p.effects.gap, facility.currency)} ({signedMoney(p.effects.volume, facility.currency)} volume, {signedMoney(p.effects.cost ?? 0, facility.currency)} cost)</>}
                {facility.forecast && <> · forecast revenue {shortWeek(facility.forecast.fromWeek)} to {shortWeek(facility.forecast.toWeek)} {moneyText(facility.forecast.revenue.expected, facility.currency)} ({moneyText(facility.forecast.revenue.low, facility.currency)} to {moneyText(facility.forecast.revenue.high, facility.currency)})</>}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {facility.cultivations.map((f) => (
                <CultivationMoneyCard key={f.cultivation.id} f={f} period={period} periodLabel={periodLabel} />
              ))}
            </div>
          </section>
        )
      })}

      <p className="text-sm">
        The since-start period adds up the weeks of the data (the workbook starts at {shortWeek(first)}, after the crops were planted), so revenue and costs cover the same weeks. A comparison with budget only uses weeks where both an actual and a budget are known. Money is in each facility's currency.
      </p>
    </div>
  )
}
