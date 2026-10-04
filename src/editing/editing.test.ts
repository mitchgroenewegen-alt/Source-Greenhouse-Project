import { describe, expect, it } from 'vitest'
import { kpiConfig } from '../config/kpis'
import { detectFlags } from '../flags'
import { applyDecisions, buildWeekly, weeklyKey } from '../scoring/effective'
import { scoreCultivationWeek } from '../scoring/summary'
import { loadTestData } from '../test/loadData'
import { correctionEdit } from '../workspace/corrections'
import { MemoryWorkspaceStore } from '../workspace/memoryStore'
import { merge } from '../workspace/merge'
import type { ValueEdit } from '../workspace/types'
import { groupEdits, correctedCells, weeklyChanges, weeksText } from './log'
import { editedWeeks, recordedValues } from './original'
import { changesNothing, lastDataDate, planEdit, requestProblem, seriesOf, toValueEdits, translateWeek } from './plan'
import { precheckChanges } from './precheck'

const base = loadTestData()
const AZ = 'AZ-P3-Snack'
const PA = 'PA-P1-TOV'
const W34 = '2025-W34'
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

const request = (cultivation: string, kpi: string, req: Parameters<typeof planEdit>[2], daily = base.daily) =>
  planEdit(seriesOf(daily, cultivation, kpi), kpiConfig(kpi).aggregation, req, lastDataDate(daily, cultivation))

function scoreOf(data: typeof base, cultivation: string, week: string, rawMode = false) {
  const flags = detectFlags(data.daily, data.cultivations)
  return scoreCultivationWeek(buildWeekly(applyDecisions(data.daily, flags, [], rawMode)), cultivation, week)
}

const edit = (overrides: Partial<ValueEdit> = {}): ValueEdit => ({
  id: 'edit|1',
  cultivation: AZ,
  kpi: 'Harvest',
  dateFrom: '2025-08-18',
  dateTo: '2025-08-18',
  field: 'target',
  newValue: 1,
  originalValue: 0.179,
  createdBy: 'dana@example.com',
  createdAt: '2025-09-01T10:00:00.000Z',
  reason: 'Edited',
  source: 'edited',
  ...overrides,
})

describe('translating a weekly value to days', () => {
  it('spreads a sum over the days of the week in proportion to their targets', () => {
    const days = [
      { date: '2025-08-18', target: 1 },
      { date: '2025-08-19', target: 3 },
    ]
    expect(translateWeek('sum', days, 8)).toEqual([
      { date: '2025-08-18', after: 2 },
      { date: '2025-08-19', after: 6 },
    ])
  })

  it('spreads a sum evenly when the days have no targets, and the week adds up exactly', () => {
    const days = ['2025-08-18', '2025-08-19', '2025-08-20'].map((date) => ({ date, target: null }))
    const out = translateWeek('sum', days, 1)
    expect(out.map((d) => d.after)).toEqual([0.3333, 0.3333, 0.3334])
    expect(sum(out.map((d) => d.after))).toBeCloseTo(1, 9)
  })

  it('gives every day the value for an average and for a last value', () => {
    const days = [{ date: '2025-08-18', target: 21 }, { date: '2025-08-19', target: 22 }]
    for (const rule of ['average', 'last'] as const) expect(translateWeek(rule, days, 20).map((d) => d.after)).toEqual([20, 20])
  })

  it('rolls up to the typed value for a real sum KPI (Harvest, W34)', () => {
    const plan = request(AZ, 'Harvest', { mode: 'week', week: W34, value: 2 })
    expect(plan.changes).toHaveLength(7)
    expect(plan.weeks).toEqual([{ week: W34, before: 1.253, after: 2 }])
    expect(plan.rangeEnd).toBeNull()
  })

  it('sets every day of an average KPI and a last-value KPI', () => {
    const avg = request(PA, 'Temperature (24h)', { mode: 'week', week: W34, value: 20 })
    expect(avg.changes.every((c) => c.after === 20)).toBe(true)
    expect(avg.weeks[0]).toMatchObject({ before: 21.5, after: 20 })
    const last = request(PA, 'Cumulative harvest', { mode: 'week', week: W34, value: 90 })
    expect(last.changes.every((c) => c.after === 90)).toBe(true)
    expect(last.weeks[0]!.after).toBe(90)
  })

  it('changes nothing when the value is already there', () => {
    expect(changesNothing(request(PA, 'Temperature (24h)', { mode: 'week', week: W34, value: 21.5 }))).toBe(true)
  })
})

describe('from a week onward', () => {
  const kpi = 'Temperature (24h)'
  it('applies to every later week with days, up to the end date', () => {
    const series = seriesOf(base.daily, PA, kpi)
    const weeks = [...new Set(series.filter((r) => r.week >= '2025-W32').map((r) => r.week))]
    const plan = request(PA, kpi, { mode: 'from', week: '2025-W32', value: 19, endDate: null })
    expect(plan.weeks.map((w) => w.week)).toEqual(weeks)
    expect(plan.weeks.every((w) => w.after === 19)).toBe(true)
    expect(plan.changes.every((c) => c.week >= '2025-W32')).toBe(true)
    expect(plan.rangeEnd).toBe(lastDataDate(base.daily, PA))
  })

  it('stops at the planned end date', () => {
    const plan = request(PA, kpi, { mode: 'from', week: '2025-W32', value: 19, endDate: '2025-08-17' })
    expect(plan.changes.at(-1)!.date).toBe('2025-08-17')
    expect(plan.rangeEnd).toBe('2025-08-17')
  })

  it('is one value edit for the whole range, reaching the end date', () => {
    const plan = request(PA, kpi, { mode: 'from', week: '2025-W32', value: 19, endDate: '2026-12-31' })
    // The days in between hold different old values, so group by them: the edit covers a run of equal old and new values.
    const edits = toValueEdits(plan.changes, { cultivation: PA, kpi, createdBy: 'a', createdAt: 't', reason: '', rangeEnd: plan.rangeEnd })
    expect(edits.at(-1)!.dateTo).toBe('2026-12-31')
    expect(edits.every((e) => e.newValue === 19 && e.source === 'edited' && e.field === 'target' && e.reason === 'Edited')).toBe(true)
    expect(edits.length).toBeLessThan(plan.changes.length)
  })

  it('does not stretch a spread sum over days that have no row', () => {
    const plan = request(AZ, 'Harvest', { mode: 'from', week: W34, value: 2, endDate: '2026-12-31' })
    expect(plan.rangeEnd).toBeNull()
  })
})

describe('scaling a range', () => {
  it('multiplies the daily targets of the weeks by the percentage', () => {
    const plan = request(AZ, 'Harvest', { mode: 'scale', fromWeek: '2025-W33', toWeek: W34, percent: 10 })
    expect(plan.weeks.map((w) => w.week)).toEqual(['2025-W33', W34])
    expect(plan.weeks[1]).toMatchObject({ before: 1.253, after: 1.3783 })
    for (const c of plan.changes) expect(c.after).toBeCloseTo(c.before! * 1.1, 6)
  })

  it('refuses a change of 0 or of -100 % and more', () => {
    expect(requestProblem({ mode: 'scale', fromWeek: W34, toWeek: W34, percent: 0 }, true)).toMatch(/other than 0/)
    expect(requestProblem({ mode: 'scale', fromWeek: W34, toWeek: W34, percent: -100 }, true)).toMatch(/-100/)
    expect(requestProblem({ mode: 'week', week: W34, value: NaN }, true)).toMatch(/number/)
    expect(requestProblem({ mode: 'scale', fromWeek: W34, toWeek: W34, percent: -10 }, true)).toBeNull()
  })
})

describe('value edits from changes', () => {
  it('makes one edit per run of days with the same old and new value, and keeps the reason', () => {
    const changes = ['2025-08-18', '2025-08-19', '2025-08-20', '2025-08-22'].map((date) => ({ date, week: W34, before: 21, after: 20 }))
    const edits = toValueEdits(changes, { cultivation: PA, kpi: 'Temperature (24h)', createdBy: 'dana@example.com', createdAt: '2025-09-01T10:00:00.000Z', reason: ' Cooler nights ' })
    expect(edits.map((e) => [e.dateFrom, e.dateTo])).toEqual([['2025-08-18', '2025-08-20'], ['2025-08-22', '2025-08-22']])
    expect(edits[0]).toMatchObject({ field: 'target', source: 'edited', newValue: 20, originalValue: 21, createdBy: 'dana@example.com', reason: 'Cooler nights' })
    expect(new Set(edits.map((e) => e.id)).size).toBe(2)
  })
})

describe('the data check before saving', () => {
  it('catches 69 as a Temperature (24h) target and suggests about 20.6', () => {
    const plan = request(PA, 'Temperature (24h)', { mode: 'week', week: W34, value: 69 })
    const result = precheckChanges(seriesOf(base.daily, PA, 'Temperature (24h)'), base.cultivations.find((c) => c.id === PA)!, plan.changes)
    expect(result.concerns.length).toBeGreaterThan(0)
    expect(result.concerns[0]!.rule).toBe('unit-fahrenheit')
    expect(result.concerns[0]!.explanation).toMatch(/Fahrenheit/)
    expect(result.concerns[0]!.explanation).toMatch(/20\.6/)
    expect(result.suggested).not.toBeNull()
    expect(result.suggested!.every((c) => c.after === 20.6)).toBe(true)
    // Taking the suggestion leaves nothing to warn about.
    expect(precheckChanges(seriesOf(base.daily, PA, 'Temperature (24h)'), base.cultivations.find((c) => c.id === PA)!, result.suggested!).concerns).toEqual([])
  })

  it('catches an impossible value and a plan far from the actuals, with no suggestion', () => {
    const series = seriesOf(base.daily, AZ, 'Harvest')
    const cultivation = base.cultivations.find((c) => c.id === AZ)!
    const negative = precheckChanges(series, cultivation, request(AZ, 'Harvest', { mode: 'week', week: W34, value: -3 }).changes)
    expect(negative.concerns.some((c) => c.rule === 'impossible-value')).toBe(true)
    expect(negative.suggested).toBeNull()
    const far = precheckChanges(seriesOf(base.daily, PA, 'Temperature (24h)'), base.cultivations.find((c) => c.id === PA)!, request(PA, 'Temperature (24h)', { mode: 'week', week: W34, value: 54 }).changes)
    expect(far.concerns.length).toBeGreaterThan(0)
  })

  it('is quiet for a sensible change', () => {
    const plan = request(PA, 'Temperature (24h)', { mode: 'week', week: W34, value: 22 })
    expect(precheckChanges(seriesOf(base.daily, PA, 'Temperature (24h)'), base.cultivations.find((c) => c.id === PA)!, plan.changes).concerns).toEqual([])
  })
})

describe('scoring with edited targets', () => {
  const plan = request(AZ, 'Harvest', { mode: 'scale', fromWeek: W34, toWeek: W34, percent: 10 })
  const edits = toValueEdits(plan.changes, { cultivation: AZ, kpi: 'Harvest', createdBy: 'dana@example.com', createdAt: '2025-09-01T10:00:00.000Z', reason: 'Edited' })
  const harvest = (data: typeof base) => scoreOf(data, AZ, W34).kpis.find((k) => k.config.name === 'Harvest')!

  it('+10 % on the W34 Harvest budget moves the W34 variance and leaves the base data untouched', () => {
    const before = JSON.stringify(base.daily.filter((r) => r.cultivation === AZ))
    const merged = merge(base, { valueEdits: edits })
    const was = harvest(base)
    const now = harvest(merged)
    expect(now.point!.target).toBeCloseTo(was.point!.target! * 1.1, 4)
    expect(now.score.variance).not.toBe(was.score.variance)
    expect(now.score.variance!).toBeLessThan(was.score.variance!)
    expect(JSON.stringify(base.daily.filter((r) => r.cultivation === AZ))).toBe(before)
    // Other weeks and other cultivations are the same.
    expect(scoreOf(merged, AZ, '2025-W33').kpis.map((k) => k.score.variance)).toEqual(scoreOf(base, AZ, '2025-W33').kpis.map((k) => k.score.variance))
  })

  it('undo restores the previous value', async () => {
    const store = new MemoryWorkspaceStore()
    await store.save('valueEdits', edits)
    const edited = merge(base, store.snapshot().data)
    expect(harvest(edited).point!.target).not.toBe(harvest(base).point!.target)
    await store.remove('valueEdits', edits.map((e) => e.id))
    const restored = merge(base, store.snapshot().data)
    expect(restored).toEqual(base)
    expect(harvest(restored).score.variance).toBe(harvest(base).score.variance)
  })

  it('undoing an older edit brings back the one under it, not the workbook', () => {
    const first = edit({ id: 'a', newValue: 0.2, createdAt: '2025-09-01T10:00:00.000Z' })
    const second = edit({ id: 'b', newValue: 0.5, createdAt: '2025-09-02T10:00:00.000Z' })
    const target = (valueEdits: ValueEdit[]) => merge(base, { valueEdits }).daily.find((r) => r.cultivation === AZ && r.kpi === 'Harvest' && r.date === '2025-08-18')!.target
    expect(target([first, second])).toBe(0.5)
    expect(target([first])).toBe(0.2)
    expect(target([])).toBe(0.179)
  })

  it('"Show raw data" ignores the edits and scores the workbook as recorded', () => {
    const workspace = { valueEdits: edits }
    const merged = merge(base, workspace)
    const raw = recordedValues(base, workspace)
    expect(raw.daily).toEqual(base.daily)
    expect(scoreOf(raw, AZ, W34, true).kpis.find((k) => k.config.name === 'Harvest')!.score.variance).toBe(harvest(base).score.variance)
    expect(harvest(merged).score.variance).not.toBe(harvest(base).score.variance)
  })

  it('raw mode keeps the budgets copied onto a new cultivation', () => {
    const copy = edit({ id: 'copy|NEW|AZ|Harvest|2025-08-18', cultivation: AZ, reason: 'Copied from X' })
    expect(recordedValues(base, { valueEdits: [copy, ...edits] }).daily.find((r) => r.cultivation === AZ && r.kpi === 'Harvest' && r.date === '2025-08-18')!.target).toBe(1)
  })
})

describe('edited weeks', () => {
  it('lists the weeks whose weekly target changed, with the value before', () => {
    const plan = request(PA, 'Temperature (24h)', { mode: 'week', week: W34, value: 20 })
    const edits = toValueEdits(plan.changes, { cultivation: PA, kpi: 'Temperature (24h)', createdBy: 'a', createdAt: 't', reason: '' })
    const merged = merge(base, { valueEdits: edits })
    const found = editedWeeks(base, { valueEdits: edits }, merged)
    expect([...found.keys()]).toEqual([weeklyKey(PA, 'Temperature (24h)', W34)])
    expect(found.get(weeklyKey(PA, 'Temperature (24h)', W34))!.original).toBe(21.5)
  })

  it('is empty without edits, and budgets copied from another cultivation do not count', () => {
    expect(editedWeeks(base, {}, base).size).toBe(0)
    const copy = edit({ id: 'copy|x', newValue: 5 })
    expect(editedWeeks(base, { valueEdits: [copy] }, merge(base, { valueEdits: [copy] })).size).toBe(0)
  })
})

describe('the edit log', () => {
  const copies = ['2025-08-18', '2025-08-19'].flatMap((date, i) =>
    ['Harvest', 'Waste'].map((kpi) => edit({ id: `copy|NEW|${AZ}|${kpi}|${date}`, cultivation: 'NEW', kpi, dateFrom: date, dateTo: date, reason: `Copied from ${AZ}`, createdAt: '2025-09-03T09:00:00.000Z', originalValue: null, newValue: i + 1 })),
  )
  const week = edit({ id: 'edit|a', createdAt: '2025-09-04T09:00:00.000Z' })
  const other = edit({ id: 'edit|b', cultivation: PA, kpi: 'Temperature (24h)', createdAt: '2025-09-02T09:00:00.000Z' })

  it('shows a copy of budgets as one line and lists the newest first', () => {
    const entries = groupEdits([other, ...copies, week])
    expect(entries.map((e) => e.createdAt)).toEqual(['2025-09-04T09:00:00.000Z', '2025-09-03T09:00:00.000Z', '2025-09-02T09:00:00.000Z'])
    const copy = entries[1]!
    expect(copy.edits).toHaveLength(4)
    expect(copy.kpi).toBeNull()
    expect(weeksText(copy)).toBe('W34')
  })

  it('reads an entry as weekly numbers over the days that have a row', () => {
    const plan = request(AZ, 'Harvest', { mode: 'week', week: W34, value: 2 })
    const edits = toValueEdits(plan.changes, { cultivation: AZ, kpi: 'Harvest', createdBy: 'a', createdAt: 't', reason: '' })
    const [entry] = groupEdits(edits)
    const rows = new Set(seriesOf(base.daily, AZ, 'Harvest').map((r) => r.date))
    expect(entry!.edits.length).toBeGreaterThan(0)
    expect(weeklyChanges(entry!, 'sum', (d) => rows.has(d))).toEqual([{ week: W34, before: 1.253, after: 2 }])
  })

  it('undoing a correction reopens its decision: the cell ids come from the edit ids', () => {
    const decision = { cellId: `${PA}|Temperature (24h)|2025-08-18|actual`, cultivation: PA, kpi: 'Temperature (24h)', date: '2025-08-18', field: 'actual' as const, rule: 'unit-fahrenheit' as const, kind: 'correct' as const, originalValue: 70, correctedValue: 21, note: '', decidedBy: 'a', decidedAt: '2025-09-05T09:00:00.000Z' }
    const [entry] = groupEdits([correctionEdit(decision)])
    expect(entry!.source).toBe('corrected')
    expect(correctedCells(entry!)).toEqual([decision.cellId])
    expect(correctedCells(groupEdits([week])[0]!)).toEqual([])
  })
})
