import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ClimateView } from '../components/climate/ClimateView'
import { Segmented } from '../components/ui/Segmented'
import { CategoryTabs } from '../components/detail/CategoryTabs'
import { DetailHeader } from '../components/detail/DetailHeader'
import { BudgetEditor } from '../components/editing/BudgetEditor'
import { KpiCard } from '../components/detail/KpiCard'
import { WeeklyTable } from '../components/detail/WeeklyTable'
import { NoDataTile } from '../components/scorecard/NoDataTile'
import { CATEGORY_LABEL, kpisInCategory, type KpiConfig } from '../config/kpis'
import { formatRange, shortWeek } from '../data/dates'
import type { Category } from '../data/types'
import type { FruitType } from '../workspace/types'
import { ForecastPanel } from '../components/forecast/ForecastPanel'
import { cumulativeForecastLine, weeklyForecastLine, type ChartForecast } from '../forecast'
import { methodText } from '../forecast/text'
import { effectiveFruitTypes, fruitTypeIdOf, specCheck } from '../setup/fruitTypes'
import { useCropData } from '../state/CropDataContext'
import { useForecasts } from '../state/useForecasts'
import { useView } from '../state/ViewContext'
import { useWorkspace } from '../workspace/WorkspaceContext'

/** Under, within or over the fruit type's weight range; null when there is no average for the week. */
const fruitWeightState = (average: number | null | undefined, type: FruitType) => (average === null || average === undefined ? null : specCheck(average, type))

export default function CultivationScreen() {
  const { id = '' } = useParams()
  const { cultivationById, weeks, point, scoreOf, dataStateOf, editedWeek, enteredWeek, data: merged, decidedBy } = useCropData()
  const workspace = useWorkspace()
  const { week, weekInfo } = useView()
  const [category, setCategory] = useState<Category>('Production')
  const [editing, setEditing] = useState<KpiConfig | null>(null)
  // Climate has two views: the daily charts a grower steers on (default) and the weekly scores like the other categories.
  const [climateView, setClimateView] = useState<'daily' | 'weekly'>('daily')
  const cultivation = cultivationById(id)

  const state = cultivation ? dataStateOf(cultivation.id) : 'ready'
  const score = cultivation ? scoreOf(cultivation.id, week) : undefined
  const kpis = useMemo(() => kpisInCategory(category), [category])
  const pointsByKpi = useMemo(
    () => (cultivation ? new Map(kpis.map((k) => [k.name, weeks.map((w) => point(cultivation.id, k.name, w.id))])) : new Map()),
    [cultivation, kpis, weeks, point],
  )

  const editedByKpi = useMemo(
    () => (cultivation ? new Map(kpis.map((k) => [k.name, weeks.map((w) => editedWeek(cultivation.id, k.name, w.id))])) : new Map()),
    [cultivation, kpis, weeks, editedWeek],
  )
  const enteredByKpi = useMemo(
    () => (cultivation ? new Map(kpis.map((k) => [k.name, weeks.map((w) => enteredWeek(cultivation.id, k.name, w.id))])) : new Map()),
    [cultivation, kpis, weeks, enteredWeek],
  )
  const editCount = cultivation ? workspace.data.valueEdits.filter((e) => e.cultivation === cultivation.id).length + workspace.data.enteredRows.filter((e) => e.cultivation === cultivation.id).length : 0

  // The forecast lines of the two harvest charts. Harvest starts from the last week's actual and Cumulative harvest from the total to date.
  const { byCultivation } = useForecasts()
  const forecast = cultivation ? byCultivation.get(cultivation.id) : undefined
  const forecastLines = useMemo(() => {
    const lines = new Map<string, ChartForecast>()
    if (!cultivation || !forecast) return lines
    lines.set('Harvest', weeklyForecastLine(forecast, point(cultivation.id, 'Harvest', forecast.asOf)?.actual ?? null))
    const cumulative = cumulativeForecastLine(forecast)
    if (cumulative) lines.set('Cumulative harvest', cumulative)
    return lines
  }, [cultivation, forecast, point])

  const fruitType = useMemo(
    () => (cultivation ? effectiveFruitTypes(workspace.data.fruitTypes).types.find((t) => t.id === fruitTypeIdOf(cultivation)) : undefined),
    [cultivation, workspace.data.fruitTypes],
  )

  if (!cultivation || !score) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Cultivation not found</h1>
        <p className="mt-1 text-ink-2">There is no cultivation called "{id}".</p>
        <Link to="/" className="mt-3 inline-block font-semibold text-brand hover:underline">
          Back to the scorecard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader cultivation={cultivation} fruitTypeName={fruitType?.name ?? null} weekEnd={weekInfo.end} weekLabel={shortWeek(week)} />
      {state !== 'ready' && <NoDataTile state={state} />}
      <p className="text-sm">
        The status badges and the highlighted column are for {shortWeek(week)}, {formatRange(weekInfo.start, weekInfo.end)}. Change the week at the top.
      </p>

      {editCount > 0 && (
        <p className="text-sm">
          This cultivation has edited or entered values.{' '}
          <Link to={`/edits?cultivation=${encodeURIComponent(cultivation.id)}`} className="font-semibold text-brand hover:underline">
            See the edit log
          </Link>
        </p>
      )}

      <CategoryTabs value={category} onChange={setCategory} categories={score.categories} />

      <div id="category-panel" role="tabpanel" aria-label={CATEGORY_LABEL[category]} className="flex flex-col gap-4">
        {category === 'Climate' && (
          <div className="rounded-2xl border border-line bg-card p-3">
            <Segmented<'daily' | 'weekly'>
              label="Show"
              value={climateView}
              onChange={setClimateView}
              options={[
                { value: 'daily', label: 'Daily charts' },
                { value: 'weekly', label: 'Weekly scores' },
              ]}
            />
          </div>
        )}
        {category === 'Climate' && climateView === 'daily' ? (
          <ClimateView cultivation={cultivation} />
        ) : (
          <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map((config) => (
            <KpiCard
              key={config.name}
              config={config}
              weeks={weeks}
              points={pointsByKpi.get(config.name)!}
              selectedWeek={week}
              edited={editedByKpi.get(config.name)!}
              onEdit={() => setEditing(config)}
              forecast={forecastLines.get(config.name) ?? null}
              forecastNote={forecast ? `Forecast: ${methodText(forecast.correction)}` : undefined}
              result={score.kpis.find((k) => k.config.name === config.name)!}
              spec={config.name === 'Fruit weight' && fruitType ? { type: fruitType, state: fruitWeightState(point(cultivation.id, config.name, week)?.actual, fruitType) } : undefined}
            />
          ))}
        </div>
        {category === 'Production' && cultivation && <ForecastPanel forecast={forecast} areaM2={cultivation.areaM2} />}
        <WeeklyTable kpis={kpis} weeks={weeks} selectedWeek={week} pointsOf={(name) => pointsByKpi.get(name)!} editedOf={(name) => editedByKpi.get(name)!} enteredOf={(name) => enteredByKpi.get(name)!} />
          </>
        )}
      </div>
      {editing && (
        <BudgetEditor
          key={editing.name}
          config={editing}
          cultivation={cultivation}
          daily={merged.daily}
          weeks={weeks}
          selectedWeek={week}
          createdBy={workspace.user ?? decidedBy}
          onSave={(edits) => workspace.save('valueEdits', edits)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
