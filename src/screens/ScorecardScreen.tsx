import { useMemo } from 'react'
import { CultivationCard } from '../components/scorecard/CultivationCard'
import { Segmented } from '../components/ui/Segmented'
import { formatRange, shortWeek } from '../data/dates'
import { compareByAttention } from '../scoring/summary'
import { useCropData } from '../state/CropDataContext'
import { ALL, useView } from '../state/ViewContext'

export default function ScorecardScreen() {
  const { cultivations, scoreOf, openReviewGroups } = useCropData()
  const { week, weekInfo, facility, setFacility, variety, setVariety } = useView()

  const facilities = useMemo(() => [ALL, ...new Set(cultivations.map((c) => c.facility))], [cultivations])
  const varieties = useMemo(() => [ALL, ...new Set(cultivations.map((c) => c.variety))], [cultivations])

  const cards = useMemo(
    () =>
      cultivations
        .filter((c) => (facility === ALL || c.facility === facility) && (variety === ALL || c.variety === variety))
        .map((c) => ({ cultivation: c, score: scoreOf(c.id, week) }))
        .sort((a, b) => compareByAttention(a.score, b.score)),
    [cultivations, facility, variety, scoreOf, week],
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Scorecard</h1>
        <p className="text-ink-2">
          {shortWeek(week)}, {formatRange(weekInfo.start, weekInfo.end)}. Actual against budget for each cultivation, worst first.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 md:flex-row md:flex-wrap md:gap-x-8">
        <Segmented label="Facility" value={facility} onChange={setFacility} options={facilities.map((f) => ({ value: f, label: f }))} />
        <Segmented label="Variety" value={variety} onChange={setVariety} options={varieties.map((v) => ({ value: v, label: v }))} />
      </div>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-ink-2">No cultivation matches these filters.</p>
      ) : (
        <>
          <p className="text-sm text-ink-3">
            {cards.length} of {cultivations.length} cultivations. Sorted by most red categories, then most amber, then the
            shortfall on cumulative harvest.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cards.map(({ cultivation, score }) => {
              const groups = openReviewGroups(cultivation.id)
              return (
                <CultivationCard
                  key={cultivation.id}
                  cultivation={cultivation}
                  score={score}
                  weekEnd={weekInfo.end}
                  weekLabel={shortWeek(week)}
                  openFlags={groups.length}
                  openFlagsThisWeek={groups.filter((g) => g.startDate <= weekInfo.end && g.endDate >= weekInfo.start).length}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
