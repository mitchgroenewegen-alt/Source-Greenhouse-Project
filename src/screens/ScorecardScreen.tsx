import { useMemo } from 'react'
import { ExportViewButton } from '../components/exchange/ExportViewButton'
import { CultivationCard } from '../components/scorecard/CultivationCard'
import { FilterSelect } from '../components/ui/FilterSelect'
import { Link } from 'react-router-dom'
import { useForecasts } from '../state/useForecasts'
import { Segmented } from '../components/ui/Segmented'
import { formatRange, shortWeek } from '../data/dates'
import { scorecardSheet, viewFilePart } from '../exchange/viewSheets'
import { compareByAttention } from '../scoring/summary'
import { useCropData } from '../state/CropDataContext'
import { ALL, useView } from '../state/ViewContext'

export default function ScorecardScreen() {
  const { cultivations, visibleCultivations, scoreOf, openReviewGroups, dataStateOf } = useCropData()
  const { byCultivation } = useForecasts()
  const { week, weekInfo, facility, setFacility, variety, setVariety } = useView()

  const facilities = useMemo(() => [ALL, ...new Set(visibleCultivations.map((c) => c.facility))], [visibleCultivations])
  const varieties = useMemo(() => [ALL, ...new Set(visibleCultivations.map((c) => c.variety))], [visibleCultivations])

  const cards = useMemo(
    () =>
      visibleCultivations
        .filter((c) => (facility === ALL || c.facility === facility) && (variety === ALL || c.variety === variety))
        .map((c) => ({ cultivation: c, score: scoreOf(c.id, week) }))
        .sort((a, b) => compareByAttention(a.score, b.score)),
    [visibleCultivations, facility, variety, scoreOf, week],
  )

  const hiddenCount = cultivations.length - visibleCultivations.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Scorecard</h1>
          <p>
            {shortWeek(week)}, {formatRange(weekInfo.start, weekInfo.end)}. Actual against budget for each cultivation, worst first.
          </p>
        </div>
        <ExportViewButton
          filePart={viewFilePart('scorecard', weekInfo)}
          build={() => [scorecardSheet(cards.map(({ cultivation, score }) => ({ cultivation, score, state: dataStateOf(cultivation.id), openFlags: openReviewGroups(cultivation.id).length })), weekInfo)]}
        />
      </div>

      {/* Phones: two drop-downs side by side. From md up: the chips. */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-card p-3 md:hidden">
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
      <div className="hidden flex-row flex-wrap gap-x-8 gap-y-2 rounded-2xl border border-line bg-card p-3 md:flex">
        <Segmented label="Facility" value={facility} onChange={setFacility} options={facilities.map((f) => ({ value: f, label: f }))} />
        <Segmented label="Variety" value={variety} onChange={setVariety} options={varieties.map((v) => ({ value: v, label: v }))} />
      </div>

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-center text-ink-2">No cultivation matches these filters.</p>
      ) : (
        <>
          <p className="-mt-1 text-sm">
            {cards.length} of {visibleCultivations.length} cultivations.{hiddenCount > 0 && ` ${hiddenCount} archived ${hiddenCount === 1 ? 'cultivation is' : 'cultivations are'} hidden; turn on Show archived on Setup to see ${hiddenCount === 1 ? 'it' : 'them'}.`}
            <span className="hidden md:inline">
              {' '}
              Sorted by Production first (red, then amber, then on track), then by the number of red and amber categories among the other four, then by the shortfall on cumulative harvest.
            </span>
          </p>
          {![...byCultivation.values()].some((f) => f.seasonEnd) && (
            <p className="-mt-1 text-sm">
              A card shows Forecast at end once its cultivation has a season budget (a Harvest budget after the last data week); there is none yet.{' '}
              <Link to="/forecast" className="font-semibold text-brand hover:underline">
                See the six-week forecast
              </Link>
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cards.map(({ cultivation, score }) => {
              const groups = openReviewGroups(cultivation.id)
              return (
                <CultivationCard
                  key={cultivation.id}
                  cultivation={cultivation}
                  score={score}
                  state={dataStateOf(cultivation.id)}
                  weekEnd={weekInfo.end}
                  weekLabel={shortWeek(week)}
                  openFlags={groups.length}
                  openFlagsThisWeek={groups.filter((g) => g.startDate <= weekInfo.end && g.endDate >= weekInfo.start).length}
                  seasonEnd={byCultivation.get(cultivation.id)?.seasonEnd}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
