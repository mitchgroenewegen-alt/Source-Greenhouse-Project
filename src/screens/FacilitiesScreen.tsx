import { useMemo, useState } from 'react'
import { ExportViewButton } from '../components/exchange/ExportViewButton'
import { FacilityCard, type Unit } from '../components/facilities/FacilityCard'
import { buildFacilitySummary } from '../components/facilities/facilitySummary'
import { FacilitySummaryTable } from '../components/facilities/FacilitySummaryTable'
import { harvestRow, KPI_FOR_PERIOD, type Period } from '../components/facilities/facilityTotals'
import { Segmented } from '../components/ui/Segmented'
import { facilitySummarySheet, harvestSheet, viewFilePart } from '../exchange/viewSheets'
import { DATA_STATE_LABEL } from '../setup/dataState'
import { formatRange, shortWeek } from '../data/dates'
import { useCropData } from '../state/CropDataContext'
import { useView } from '../state/ViewContext'

export default function FacilitiesScreen() {
  const { cultivations, visibleCultivations, point, dataStateOf } = useCropData()
  const { week, weekInfo } = useView()
  const [period, setPeriod] = useState<Period>('week')
  const [unit, setUnit] = useState<Unit>('kgm2')

  const facilities = useMemo(() => [...new Set(visibleCultivations.map((c) => c.facility))], [visibleCultivations])
  const byFacility = useMemo(
    () =>
      facilities.map((facility) => ({
        facility,
        rows: visibleCultivations
          .filter((c) => c.facility === facility)
          .map((c) => harvestRow(c, point(c.id, KPI_FOR_PERIOD[period], week), period)),
      })),
    [facilities, visibleCultivations, point, period, week],
  )

  // The summary follows the week but not the toggles below: it always shows both periods.
  const summary = useMemo(() => buildFacilitySummary(visibleCultivations, (id, kpi) => point(id, kpi, week)), [visibleCultivations, point, week])

  // A cultivation with no budget or no values yet says so in its row, instead of "Not scored".
  const emptyLabelOf = (id: string) => {
    const state = dataStateOf(id)
    return state === 'ready' ? undefined : DATA_STATE_LABEL[state]
  }
  // The tables of this screen for the selected week: the summary, and the harvest of each cultivation for the week and to date.
  const buildExport = () => {
    const ordered = facilities.flatMap((f) => visibleCultivations.filter((c) => c.facility === f))
    const rowsFor = (period: Period) => ordered.map((c) => harvestRow(c, point(c.id, KPI_FOR_PERIOD[period], week), period))
    return [facilitySummarySheet(summary, weekInfo), harvestSheet(rowsFor('week'), rowsFor('cumulative'), weekInfo)]
  }
  const hiddenCount = cultivations.length - visibleCultivations.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Facility comparison</h1>
          <p>
            Harvest against budget for each cultivation, grouped by facility. {shortWeek(week)}, {formatRange(weekInfo.start, weekInfo.end)}.
          </p>
        </div>
        <ExportViewButton filePart={viewFilePart('facilities', weekInfo)} build={buildExport} />
      </div>

      <FacilitySummaryTable rows={summary} weekLabel={shortWeek(week)} />

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 md:flex-row md:gap-x-8">
        <Segmented
          label="Harvest"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: `${shortWeek(week)} only` },
            { value: 'cumulative', label: `Total to end of ${shortWeek(week)}` },
          ]}
        />
        <Segmented
          label="Unit"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'kgm2', label: 'kg/m²' },
            { value: 'tonnes', label: 'Tonnes' },
          ]}
        />
      </div>
      <p className="text-sm">
        Tonnes are kg/m² × growing area ÷ 1000. The facility total in kg/m² is weighted by growing area, so a large greenhouse counts for more than a small one.
        {hiddenCount > 0 && ` ${hiddenCount} archived ${hiddenCount === 1 ? 'cultivation is' : 'cultivations are'} hidden; turn on Show archived on Setup to see ${hiddenCount === 1 ? 'it' : 'them'}.`}
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {byFacility.map(({ facility, rows }) => (
          <FacilityCard key={facility} facility={facility} rows={rows} period={period} unit={unit} emptyLabelOf={emptyLabelOf} />
        ))}
      </div>
    </div>
  )
}
