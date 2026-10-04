import { describe, expect, it, vi } from 'vitest'
import { loadTestData } from '../test/loadData'
import { MemoryDecisionStore } from '../storage/decisionStore'
import { scoreCultivationWeek } from '../scoring/summary'
import { buildWeekly, applyDecisions } from '../scoring/effective'
import { detectFlags } from '../flags'
import { LocalWorkspaceStore } from './localStore'
import { MemoryWorkspaceStore } from './memoryStore'
import { merge } from './merge'
import { itemToRow, rowToItem, tableSpec } from './supabaseStore'
import { WorkspaceReadOnlyError, ENTITY_KEY, type EnteredRow, type ValueEdit, type WorkspaceCultivation } from './types'

const base = loadTestData()
const CUM = 'Cumulative harvest'

function dailyOf(data: typeof base, date: string) {
  return data.daily.find((r) => r.cultivation === 'PA-P1-TOV' && r.kpi === CUM && r.date === date)!
}

function edit(overrides: Partial<ValueEdit> = {}): ValueEdit {
  return {
    id: 'e1',
    cultivation: 'PA-P1-TOV',
    kpi: CUM,
    dateFrom: '2025-08-24',
    dateTo: '2025-08-24',
    field: 'actual',
    newValue: 60,
    originalValue: 84.44,
    createdBy: 'dana@example.com',
    createdAt: '2025-09-01T10:00:00.000Z',
    reason: 'Scale was reset',
    source: 'edited',
    ...overrides,
  }
}

function scoreOf(data: typeof base) {
  const flags = detectFlags(data.daily, data.cultivations)
  const lookup = buildWeekly(applyDecisions(data.daily, flags, [], true))
  return scoreCultivationWeek(lookup, 'PA-P1-TOV', '2025-W34')
}

describe('merge', () => {
  it('with an empty workspace gives the same data as the workbook', () => {
    expect(merge(base, {})).toEqual(base)
    const cum = merge(base, {}).weekly.find((w) => w.cultivation === 'PA-P1-TOV' && w.kpi === CUM && w.week === '2025-W34')!
    expect(cum.actual).toBe(84.44)
    expect(cum.target).toBe(79.91)
    expect(dailyOf(merge(base, {}), '2025-08-24')).toMatchObject({ actual: 84.44, target: 79.91 })
  })

  it('a value edit changes the score and leaves the base untouched', () => {
    const before = structuredClone(base)
    const merged = merge(base, { valueEdits: [edit()] })
    expect(dailyOf(merged, '2025-08-24').actual).toBe(60)
    expect(dailyOf(base, '2025-08-24').actual).toBe(84.44)
    expect(base).toEqual(before)
    const kpiResult = (data: typeof base) => scoreOf(data).kpis.find((k) => k.config.name === CUM)!
    expect(kpiResult(base).score.status).not.toBe(kpiResult(merged).score.status)
    expect(kpiResult(merged).point!.actual).toBe(60)
  })

  it('applies the newest edit last and can skip corrections', () => {
    const edits = [edit({ id: 'a', newValue: 1, createdAt: '2025-09-02T00:00:00Z' }), edit({ id: 'b', newValue: 2, createdAt: '2025-09-01T00:00:00Z' })]
    expect(dailyOf(merge(base, { valueEdits: edits }), '2025-08-24').actual).toBe(1)
    const corrected = edit({ source: 'corrected' })
    expect(dailyOf(merge(base, { valueEdits: [corrected] }, { skipCorrected: true }), '2025-08-24').actual).toBe(84.44)
  })

  it('an entered row in W35 makes W35 the latest and default week', () => {
    const entered: EnteredRow = { cultivation: 'PA-P1-TOV', date: '2025-08-25', kpi: CUM, actual: 85, target: 80, createdBy: 'dana', createdAt: '2025-08-26T00:00:00Z', source: 'entered' }
    const merged = merge(base, { enteredRows: [entered] })
    expect(merged.weeks.at(-1)!.id).toBe('2025-W35')
    expect(merged.weeks.at(-1)!.start).toBe('2025-08-25')
    expect(merged.meta.periodEnd).toBe('2025-08-25')
    expect(merged.meta.weekCount).toBe(base.meta.weekCount + 1)
    expect(merged.weekly.find((w) => w.week === '2025-W35')).toMatchObject({ actual: 85, target: 80, days: 1 })
  })

  it('an entered row replaces the same date, cultivation and KPI', () => {
    const entered: EnteredRow = { cultivation: 'PA-P1-TOV', date: '2025-08-24', kpi: CUM, actual: 90, target: 79.91, createdBy: 'dana', createdAt: '2025-09-01T00:00:00Z', source: 'entered' }
    const merged = merge(base, { enteredRows: [entered] })
    expect(merged.daily).toHaveLength(base.daily.length)
    expect(dailyOf(merged, '2025-08-24').actual).toBe(90)
  })

  it('adds, edits and archives cultivations', () => {
    const first = base.cultivations[0]!
    const added: WorkspaceCultivation = { ...first, id: 'NEW-TOV', areaM2: 100, fruitType: null, plannedEndDate: null, archived: false }
    const archived: WorkspaceCultivation = { ...first, variety: 'Changed', fruitType: null, plannedEndDate: null, archived: true }
    const merged = merge(base, { cultivations: [added, archived] })
    expect(merged.cultivations).toHaveLength(base.cultivations.length + 1)
    expect(merged.cultivations[0]).toMatchObject({ id: first.id, variety: 'Changed', archived: true })
    expect(merged.cultivations.at(-1)!.id).toBe('NEW-TOV')
    expect(base.cultivations[0]!.variety).toBe(first.variety)
  })
})

const samplesDecision = { cellId: 'PA-P2-TOV|Temperature (24h)|2025-07-01|target', cultivation: 'PA-P2-TOV', kpi: 'Temperature (24h)', date: '2025-07-01', field: 'target' as const, rule: 'unit-fahrenheit' as const, originalValue: 69, kind: 'correct' as const, correctedValue: 20.6, decidedBy: 'Dana', decidedAt: '2025-09-01T10:00:00.000Z', note: '' }

describe('MemoryWorkspaceStore', () => {
  const samples = {
    facilities: [{ id: 'f1', name: 'Pennsylvania', region: 'US-East', currency: 'USD' }],
    greenhouses: [{ id: 'g1', facilityId: 'f1', name: 'Phase 1', areaM2: 1000, ledWattsPerM2: null }],
    cultivations: [{ ...base.cultivations[0]!, fruitType: 'ft1', plannedEndDate: '2025-12-01', archived: false }],
    valueEdits: [edit()],
    enteredRows: [{ cultivation: 'PA-P1-TOV', date: '2025-08-25', kpi: CUM, actual: 85, target: null, createdBy: 'd', createdAt: '2025-08-26T00:00:00Z', source: 'entered' as const }],
    fruitTypes: [{ id: 'ft1', name: 'Tomato', weightMinG: 80, weightMaxG: 120, diameterMinMm: null, diameterMaxMm: null, pricePerKg: null, placeholder: true }],
    rates: [{ facilityId: 'f1', heatPerKwh: 0.05, electricityPerKwh: null, waterPerM3: null, priceOverrides: { tov: 3.2 }, updatedBy: 'd', updatedAt: '2025-09-01T10:00:00.000Z' }],
    decisions: [
      { cellId: 'PA-P2-TOV|Temperature (24h)|2025-07-01|target', cultivation: 'PA-P2-TOV', kpi: 'Temperature (24h)', date: '2025-07-01', field: 'target' as const, rule: 'unit-fahrenheit' as const, originalValue: 69, kind: 'correct' as const, correctedValue: 20.6, decidedBy: 'Dana', decidedAt: '2025-09-01T10:00:00.000Z', note: '' },
    ],
  }

  for (const [name, items] of Object.entries(samples)) {
    it(`round-trips ${name}`, async () => {
      const entity = name as keyof typeof samples
      const store = new MemoryWorkspaceStore()
      const listener = vi.fn()
      store.subscribe(listener)
      const before = store.snapshot()
      await store.save(entity, items as never)
      expect(store.snapshot()).not.toBe(before)
      expect(store.snapshot().data[entity]).toEqual(items)
      await store.save(entity, items as never) // same key: replaces, no duplicate
      expect(store.snapshot().data[entity]).toHaveLength(1)
      const keyOf = ENTITY_KEY[entity] as (x: unknown) => string
      await store.remove(entity, [keyOf(items[0])])
      expect(store.snapshot().data[entity]).toEqual([])
      expect(listener).toHaveBeenCalledTimes(3)
    })
  }

  it('refuses writes while read-only', async () => {
    const store = new MemoryWorkspaceStore({}, 'offline-readonly')
    await expect(store.save('facilities', samples.facilities)).rejects.toBeInstanceOf(WorkspaceReadOnlyError)
    expect(store.snapshot().data.facilities).toEqual([])
  })
})

describe('Supabase row mapping', () => {
  it('maps every entity to snake_case columns and back', () => {
    const probe = {
      facilities: { id: 'f1', name: 'PA', region: 'East', currency: 'USD' },
      greenhouses: { id: 'g1', facilityId: 'f1', name: 'P1', areaM2: 10, ledWattsPerM2: 5 },
      valueEdits: edit(),
      rates: { facilityId: 'f1', heatPerKwh: 0.1, electricityPerKwh: null, waterPerM3: 2, priceOverrides: { tov: 3.2 }, updatedBy: 'd', updatedAt: '2025-09-01T10:00:00.000Z' },
    }
    for (const [entity, item] of Object.entries(probe)) {
      const spec = tableSpec(entity as keyof typeof probe)
      const row = itemToRow(spec, item)
      expect(Object.keys(row).every((k) => k === k.toLowerCase())).toBe(true)
      expect(rowToItem(spec, row)).toEqual(item)
    }
    expect(itemToRow(tableSpec('greenhouses'), probe.greenhouses)).toMatchObject({ facility_id: 'f1', area_m2: 10, led_watts_per_m2: 5 })
    expect(itemToRow(tableSpec('valueEdits'), probe.valueEdits)).toMatchObject({ created_by_name: 'dana@example.com', date_from: '2025-08-24' })
  })
})

describe('LocalWorkspaceStore', () => {
  it('keeps decisions where they were and works without IndexedDB', async () => {
    const old = { ...samplesDecision }
    const decisions = new MemoryDecisionStore([old])
    const store = new LocalWorkspaceStore(decisions)
    expect(store.snapshot().ready).toBe(false)
    await store.start() // Node has no IndexedDB: starts empty and carries on
    expect(store.snapshot().ready).toBe(true)
    expect(store.snapshot().status).toBe('local')
    expect(store.snapshot().data.decisions).toEqual([old])
    await store.save('decisions', [{ ...old, kind: 'confirm', correctedValue: null }])
    expect(decisions.getAll()[0]!.kind).toBe('confirm')
    await store.save('facilities', [{ id: 'f1', name: 'PA', region: 'East', currency: 'USD' }])
    expect(store.snapshot().data.facilities).toHaveLength(1)
  })
})
