import { useMemo } from 'react'
import { CultivationCard } from '../components/scorecard/CultivationCard'
import { FilterSelect } from '../components/ui/FilterSelect'
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

      {/* Phones: two drop-downs side by side. From md up: the chips. */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <FilterSelect
          label="Facility"
          value={facility}
          onChange={setFacility}
          options={facilities.map((f) => ({ value: f, label: f === ALL ? 'All facilities' : f }))}
        />
        <FilterSelect
          label="Variety"
          value={variety}
          onChange={setVariety}
          options={varieties.map((v) => ({ value: v, label: v === ALL ? 'All varieties' : v }))}
        />
      </div>
      <div className="hidden flex-row flex-wrap gap-x-8 gap-y-2 rounded-xl border border-line bg-card p-3 md:flex">
        <Segmented label="Facility" value={facility} onChange={setFacility} options={facilities.map((f) => ({ value: f, label: f }))} />
        <Segmented label="Variety" value={variety} onChange={setVariety} options={varieties.map((v) => ({ value: v, label: v }))} />
      </div>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-ink-2">No cultivation matches these filters.</p>
      ) : (
        <>
          <p className="-mt-1 text-sm text-ink-3">
            {cards.length} of {cultivations.length} cultivations.
            <span className="hidden md:inline">
              {' '}
              Sorted by Production first (red, then amber, then on track), then by the number of red and amber categories among the other four, then by the shortfall on cumulative harvest.
            </span>
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
