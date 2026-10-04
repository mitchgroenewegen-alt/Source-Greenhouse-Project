import { useMemo, useState } from 'react'
import { FacilityCard, type Unit } from '../components/facilities/FacilityCard'
import { buildFacilitySummary } from '../components/facilities/facilitySummary'
import { FacilitySummaryTable } from '../components/facilities/FacilitySummaryTable'
import { harvestRow, KPI_FOR_PERIOD, type Period } from '../components/facilities/facilityTotals'
import { Segmented } from '../components/ui/Segmented'
import { formatRange, shortWeek } from '../data/dates'
import { useCropData } from '../state/CropDataContext'
import { useView } from '../state/ViewContext'

export default function FacilitiesScreen() {
  const { cultivations, point } = useCropData()
  const { week, weekInfo } = useView()
  const [period, setPeriod] = useState<Period>('week')
  const [unit, setUnit] = useState<Unit>('kgm2')

  const facilities = useMemo(() => [...new Set(cultivations.map((c) => c.facility))], [cultivations])
  const byFacility = useMemo(
    () =>
      facilities.map((facility) => ({
        facility,
        rows: cultivations
          .filter((c) => c.facility === facility)
          .map((c) => harvestRow(c, point(c.id, KPI_FOR_PERIOD[period], week), period)),
      })),
    [facilities, cultivations, point, period, week],
  )

  // The summary follows the week but not the toggles below: it always shows both periods.
  const summary = useMemo(() => buildFacilitySummary(cultivations, (id, kpi) => point(id, kpi, week)), [cultivations, point, week])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Facility comparison</h1>
        <p>
          Harvest against budget for each cultivation, grouped by facility. {shortWeek(week)}, {formatRange(weekInfo.start, weekInfo.end)}.
        </p>
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
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {byFacility.map(({ facility, rows }) => (
          <FacilityCard key={facility} facility={facility} rows={rows} period={period} unit={unit} />
        ))}
      </div>
    </div>
  )
}
