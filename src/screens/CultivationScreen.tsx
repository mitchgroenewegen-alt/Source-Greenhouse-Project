import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CategoryTabs } from '../components/detail/CategoryTabs'
import { DetailHeader } from '../components/detail/DetailHeader'
import { KpiCard } from '../components/detail/KpiCard'
import { WeeklyTable } from '../components/detail/WeeklyTable'
import { CATEGORY_LABEL, kpisInCategory } from '../config/kpis'
import { formatRange, shortWeek } from '../data/dates'
import type { Category } from '../data/types'
import { useCropData } from '../state/CropDataContext'
import { useView } from '../state/ViewContext'

export default function CultivationScreen() {
  const { id = '' } = useParams()
  const { cultivationById, weeks, point, scoreOf } = useCropData()
  const { week, weekInfo } = useView()
  const [category, setCategory] = useState<Category>('Production')
  const cultivation = cultivationById(id)

  const score = cultivation ? scoreOf(cultivation.id, week) : undefined
  const kpis = useMemo(() => kpisInCategory(category), [category])
  const pointsByKpi = useMemo(
    () => (cultivation ? new Map(kpis.map((k) => [k.name, weeks.map((w) => point(cultivation.id, k.name, w.id))])) : new Map()),
    [cultivation, kpis, weeks, point],
  )

  if (!cultivation || !score) {
    return (
      <div className="rounded-xl border border-line bg-card p-6 text-center">
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
      <DetailHeader cultivation={cultivation} weekEnd={weekInfo.end} weekLabel={shortWeek(week)} />
      <p className="text-sm text-ink-2">
        The status badges and the highlighted column are for {shortWeek(week)}, {formatRange(weekInfo.start, weekInfo.end)}. Change the week at the top.
      </p>

      <CategoryTabs value={category} onChange={setCategory} categories={score.categories} />

      <div id="category-panel" role="tabpanel" aria-label={CATEGORY_LABEL[category]} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map((config) => (
            <KpiCard
              key={config.name}
              config={config}
              weeks={weeks}
              points={pointsByKpi.get(config.name)!}
              selectedWeek={week}
              result={score.kpis.find((k) => k.config.name === config.name)!}
            />
          ))}
        </div>
        <WeeklyTable kpis={kpis} weeks={weeks} selectedWeek={week} pointsOf={(name) => pointsByKpi.get(name)!} />
      </div>
    </div>
  )
}
