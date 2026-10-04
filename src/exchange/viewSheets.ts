// "Export this view": just the table of one screen for the selected week, as a one-sheet or two-sheet workbook.

import { CATEGORY_LABEL, CATEGORY_ORDER, KPI_CONFIG, planWord } from '../config/kpis'
import { shortWeek } from '../data/dates'
import type { Cultivation, WeekInfo } from '../data/types'
import type { FacilitySummaryRow } from '../components/facilities/facilitySummary'
import type { HarvestRow } from '../components/facilities/facilityTotals'
import { STATUS_LABEL, type Status } from '../scoring/score'
import type { CultivationScore } from '../scoring/summary'
import { DATA_STATE_LABEL, type DataState } from '../setup/dataState'
import type { CultivationFinancials, FacilityFinancials, Financials, Period } from '../financials'
import { numberCell, type Cell, type SheetSpec } from './sheets'

const statusText = (status: Status | null) => (status ? STATUS_LABEL[status] : 'Not scored')

export interface ScorecardRow {
  cultivation: Cultivation
  score: CultivationScore
  state: DataState
  /** Data checks still waiting for a decision. */
  openFlags: number
}

/** The Scorecard as it is on screen (worst first, filters applied): one row per cultivation, a status per category and the headline KPIs. */
export function scorecardSheet(rows: ScorecardRow[], week: WeekInfo): SheetSpec {
  const headline = KPI_CONFIG.filter((k) => k.showOnScorecard)
  const header: Cell[] = [
    'Cultivation',
    'Facility',
    'Greenhouse',
    'Variety',
    'Note',
    ...CATEGORY_ORDER.map((c) => `${CATEGORY_LABEL[c]} status`),
    ...headline.flatMap((k): Cell[] => [`${k.name}: actual (${k.unit})`, `${k.name}: ${planWord(k)} (${k.unit})`, `${k.name}: variance (${k.variance === 'percent' ? '%' : k.unit})`, `${k.name}: status`]),
    'Open data checks',
  ]
  const body = rows.map(({ cultivation: c, score, state, openFlags }): Cell[] => [
    c.id,
    c.facility,
    c.greenhouse,
    c.variety,
    state === 'ready' ? null : DATA_STATE_LABEL[state],
    ...score.categories.map((cat) => statusText(cat.status)),
    ...headline.flatMap((k): Cell[] => {
      const result = score.kpis.find((r) => r.config.name === k.name)!
      const p = result.point?.paired ? result.point : undefined
      return [numberCell(p?.actual), numberCell(p?.target), numberCell(result.score.variance), statusText(result.score.status)]
    }),
    openFlags,
  ])
  return {
    name: `Scorecard ${shortWeek(week.id)}`,
    rows: [header, ...body],
    widths: [14, 14, 12, 12, 14, ...CATEGORY_ORDER.map(() => 14), ...headline.flatMap(() => [18, 18, 18, 12]), 10],
  }
}

/** The harvest per cultivation for the week and since planting (kg/m²), as the cards on the Facilities screen have it. */
export function harvestSheet(week: HarvestRow[], cumulative: HarvestRow[], weekInfo: WeekInfo): SheetSpec {
  const header: Cell[] = ['Facility', 'Cultivation', 'Growing area (m²)', 'Week: actual (kg/m²)', 'Week: budget (kg/m²)', 'Week: variance (%)', 'Week: status', 'To date: actual (kg/m²)', 'To date: budget (kg/m²)', 'To date: variance (%)', 'To date: status']
  const body = week.map((w, i): Cell[] => {
    const c = cumulative[i]!
    return [w.cultivation.facility, w.cultivation.id, w.cultivation.areaM2, numberCell(w.actual), numberCell(w.budget), numberCell(w.variance), statusText(w.status), numberCell(c.actual), numberCell(c.budget), numberCell(c.variance), statusText(c.status)]
  })
  return { name: `Cultivations ${shortWeek(weekInfo.id)}`, rows: [header, ...body], widths: [14, 14, 16, 18, 18, 16, 12, 20, 20, 18, 12] }
}

/** The summary table at the top of the Facilities screen: one row per facility and one for all of them (totals are weighted by growing area). */
export function facilitySummarySheet(rows: FacilitySummaryRow[], week: WeekInfo): SheetSpec {
  const header: Cell[] = [
    'Facility',
    'Cultivations',
    'Growing area (m²)',
    'Week: actual (kg/m²)',
    'Week: budget (kg/m²)',
    'Week: variance (%)',
    'Week: status',
    'Week: actual (tonnes)',
    'Week: budget (tonnes)',
    'To date: actual (kg/m²)',
    'To date: budget (kg/m²)',
    'To date: variance (%)',
    'To date: status',
    'To date: actual (tonnes)',
    'To date: budget (tonnes)',
  ]
  const body = rows.map((r): Cell[] => [
    r.label,
    r.cultivationCount,
    r.areaM2,
    numberCell(r.week.actual),
    numberCell(r.week.budget),
    numberCell(r.week.variance),
    statusText(r.week.status),
    numberCell(r.week.actualTonnes),
    numberCell(r.week.budgetTonnes),
    numberCell(r.cumulative.actual),
    numberCell(r.cumulative.budget),
    numberCell(r.cumulative.variance),
    statusText(r.cumulative.status),
    numberCell(r.cumulative.actualTonnes),
    numberCell(r.cumulative.budgetTonnes),
  ])
  return { name: `Facilities ${shortWeek(week.id)}`, rows: [header, ...body], widths: [18, 13, 16, 18, 18, 16, 12, 18, 18, 20, 20, 18, 12, 20, 20] }
}

/** For the file name: "2025-W34". */
export const viewFilePart = (kind: 'scorecard' | 'facilities' | 'financials', week: WeekInfo) => `${kind}-${week.id}`


/** The money columns of one period: each line actual and budget, then the gap split. Empty where a figure is not available. */
export const periodHeader = (prefix: string): Cell[] => [
  `${prefix}: revenue (actual)`,
  `${prefix}: revenue (budget)`,
  `${prefix}: value lost to waste (actual)`,
  `${prefix}: value lost to waste (budget)`,
  `${prefix}: heating cost (actual)`,
  `${prefix}: heating cost (budget)`,
  `${prefix}: LED cost (actual)`,
  `${prefix}: LED cost (budget)`,
  `${prefix}: water cost (actual)`,
  `${prefix}: water cost (no target)`,
  `${prefix}: energy and water cost (actual)`,
  `${prefix}: energy and water cost (budget)`,
  `${prefix}: partial margin (actual)`,
  `${prefix}: partial margin (budget)`,
  `${prefix}: gap in margin: volume effect`,
  `${prefix}: gap in margin: cost effect`,
  `${prefix}: gap in margin: total`,
]

export const periodCells = (p: Period): Cell[] => [
  numberCell(p.revenue.actual),
  numberCell(p.revenue.budget),
  numberCell(p.wasteValue.actual),
  numberCell(p.wasteValue.budget),
  numberCell(p.heat.actual),
  numberCell(p.heat.budget),
  numberCell(p.led.actual),
  numberCell(p.led.budget),
  numberCell(p.water.actual),
  numberCell(p.water.budget),
  numberCell(p.costs.actual),
  numberCell(p.costs.budget),
  numberCell(p.margin.actual),
  numberCell(p.margin.budget),
  numberCell(p.effects?.volume),
  numberCell(p.effects?.cost),
  numberCell(p.effects?.gap),
]

/**
 * The Financials screen: a row per cultivation, then one per facility and one for all of them, for the selected week and for the weeks
 * since the start of the data (`firstWeek`), plus the expected revenue of the forecast weeks. Money is in each row's currency.
 */
export function financialsViewSheet(financials: Financials, week: WeekInfo, firstWeek: string): SheetSpec {
  const header: Cell[] = [
    'Facility',
    'Cultivation',
    'Growing area (m²)',
    'Currency',
    'Price per kg',
    'Price from',
    'Example prices',
    ...periodHeader(shortWeek(week.id)),
    ...periodHeader(`Since ${shortWeek(firstWeek)}`),
    'Forecast revenue: low',
    'Forecast revenue: expected',
    'Forecast revenue: high',
  ]
  const forecast = (r: { low: number; expected: number; high: number } | null | undefined): Cell[] => [numberCell(r?.low), numberCell(r?.expected), numberCell(r?.high)]
  const priceFrom = { facility: 'Facility price', 'fruit-type': 'Fruit type price', example: 'Example price', none: 'No price' } as const
  const cultivationRow = (f: CultivationFinancials): Cell[] => [
    f.cultivation.facility,
    f.cultivation.id,
    f.cultivation.areaM2,
    f.currency,
    numberCell(f.price.value),
    priceFrom[f.price.source],
    f.price.source === 'example' ? 'Yes' : 'No',
    ...periodCells(f.week),
    ...periodCells(f.toDate),
    ...forecast(f.forecast?.revenue),
  ]
  const totalRow = (r: FacilityFinancials, label: string): Cell[] => [
    label,
    r.cardId ? 'All cultivations' : 'All cultivations of all facilities',
    r.areaM2,
    r.currency,
    null,
    null,
    null,
    ...periodCells(r.week),
    ...periodCells(r.toDate),
    ...forecast(r.forecast?.revenue),
  ]
  const rows: Cell[][] = [header]
  for (const facility of financials.facilities) {
    rows.push(...facility.cultivations.map(cultivationRow), totalRow(facility, facility.label))
  }
  if (financials.all) rows.push(totalRow(financials.all, financials.all.label))
  return { name: `Financials ${shortWeek(week.id)}`, rows, widths: [14, 16, 16, 9, 12, 16, 12, ...Array(34).fill(18), 16, 18, 16] }
}
