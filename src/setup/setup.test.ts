import { describe, expect, it } from 'vitest'
import { detectFlags } from '../flags'
import { applyDecisions, buildWeekly } from '../scoring/effective'
import { scoreCultivationWeek } from '../scoring/summary'
import { loadTestData } from '../test/loadData'
import { merge } from '../workspace/merge'
import type { WorkspaceCultivation } from '../workspace/types'
import type { DailyRow } from '../data/types'
import { buildCatalog, greenhouseOf } from './catalog'
import { cultivationIdFor, facilityCode, freeId, greenhouseCode, varietyPart } from './codes'
import { budgetCopyEdits, copySources } from './copyBudgets'
import { dataStateOf, dataStates, latestWeekWithActuals } from './dataState'
import { cultivationsUsing, DEFAULT_FRUIT_TYPES, effectiveFruitTypes, fruitTypeId, fruitTypeIdOf, itemsToSave, measuredFruitWeight, removalBlock, specCheck, validateFruitType, weightRangeText } from './fruitTypes'
import { defaultPlannedEnd, validateCultivation, validateFacility, validateGreenhouse, type CultivationForm } from './validate'

const base = loadTestData()
const catalog = buildCatalog(base.cultivations, { facilities: [], greenhouses: [] })

describe('ids', () => {
  it('builds codes the way the workbook ids do', () => {
    expect(facilityCode('Ontario')).toBe('ON')
    expect(facilityCode('New Mexico')).toBe('NM')
    expect(greenhouseCode('Phase 2')).toBe('P2')
    expect(greenhouseCode('Tunnel North')).toBe('TN')
    expect(varietyPart('Grape on the vine')).toBe('GrapeOnTheVine')
    expect(cultivationIdFor('ON-P2', 'TOV')).toBe('ON-P2-TOV')
    expect(cultivationIdFor('ON-P2', '')).toBe('')
  })

  it('works out the workbook facilities and greenhouses from the cultivation ids', () => {
    expect(catalog.facilities.map((f) => f.id)).toEqual(['PA', 'AZ', 'ON'])
    expect(catalog.greenhouses.map((g) => g.id)).toEqual(['PA-P1', 'PA-P2', 'PA-P3', 'AZ-P1', 'AZ-P2', 'AZ-P3', 'ON-P1'])
    // The two Ontario cultivations fill the greenhouse they share.
    expect(catalog.greenhouses.find((g) => g.id === 'ON-P1')!.areaM2).toBe(11600 + 27400)
    expect(greenhouseOf(base.cultivations[7]!, catalog)!.id).toBe('ON-P1')
  })

  it('lays a stored greenhouse over the workbook one and keeps a new one', () => {
    const withStored = buildCatalog(base.cultivations, {
      facilities: [],
      greenhouses: [
        { id: 'ON-P1', facilityId: 'ON', name: 'Phase 1', areaM2: 50000, ledWattsPerM2: 120 },
        { id: 'ON-P2', facilityId: 'ON', name: 'Phase 2', areaM2: 8000, ledWattsPerM2: null },
      ],
    })
    expect(withStored.greenhouses.find((g) => g.id === 'ON-P1')).toMatchObject({ areaM2: 50000, ledWattsPerM2: 120, fromWorkbook: true })
    expect(withStored.greenhouses.find((g) => g.id === 'ON-P2')).toMatchObject({ code: 'P2', facilityName: 'Ontario', fromWorkbook: false })
  })

  it('suggests a free id when the wanted one is taken', () => {
    expect(freeId('ON-P1-TOV', base.cultivations.map((c) => c.id))).toBe('ON-P1-TOV-2')
    expect(freeId('on-p1-tov', base.cultivations.map((c) => c.id))).toBe('on-p1-tov-2')
    expect(freeId('ON-P1-TOV', ['ON-P1-TOV', 'ON-P1-TOV-2'])).toBe('ON-P1-TOV-3')
    expect(freeId('ON-P2-TOV', base.cultivations.map((c) => c.id))).toBe('ON-P2-TOV')
  })
})

const withP2 = buildCatalog(base.cultivations, { facilities: [], greenhouses: [{ id: 'ON-P2', facilityId: 'ON', name: 'Phase 2', areaM2: 10000, ledWattsPerM2: null }] })
const form = (overrides: Partial<CultivationForm> = {}): CultivationForm => ({
  id: 'ON-P2-TOV',
  greenhouseId: 'ON-P2',
  fruitType: 'tov',
  variety: 'TOV',
  plantingDate: '2026-01-05',
  plannedEndDate: '2026-12-07',
  areaM2: '6000',
  ...overrides,
})
const ctx = { catalog: withP2, cultivations: base.cultivations, fruitTypeIds: ['tov', 'cherry'], editingId: null as string | null }

describe('validation', () => {
  it('accepts a good cultivation', () => {
    expect(validateCultivation(form(), ctx)).toEqual({})
  })

  it('plans 48 weeks from planting by default', () => {
    expect(defaultPlannedEnd('2026-01-05')).toBe('2026-12-07')
  })

  it('rejects an id that is already used, ignoring case and including archived ones', () => {
    expect(validateCultivation(form({ id: 'ON-P1-TOV' }), ctx).id).toMatch(/already exists/)
    expect(validateCultivation(form({ id: 'on-p1-tov' }), ctx).id).toMatch(/already exists/)
    const archived: WorkspaceCultivation = { ...base.cultivations[0]!, archived: true, fruitType: null, plannedEndDate: null }
    const archivedCtx = { ...ctx, cultivations: [archived, ...base.cultivations.slice(1)] }
    expect(validateCultivation(form({ id: archived.id }), archivedCtx).id).toMatch(/\(archived\)/)
    // Editing the cultivation itself is not a clash.
    expect(validateCultivation(form({ id: 'ON-P1-TOV', greenhouseId: 'ON-P1', areaM2: '27400' }), { ...ctx, editingId: 'ON-P1-TOV' })).toEqual({})
    expect(validateCultivation(form({ id: 'ON P2' }), ctx).id).toMatch(/letters, digits and dashes/)
  })

  it('keeps the cultivations of a greenhouse within its area', () => {
    expect(validateCultivation(form({ areaM2: '10000' }), ctx)).toEqual({})
    expect(validateCultivation(form({ areaM2: '10001' }), ctx).areaM2).toMatch(/Too big/)
    // ON-P1 is full (11 600 + 27 400 m²): a bigger cultivation does not fit, the same size does when it is the one being edited.
    expect(validateCultivation(form({ greenhouseId: 'ON-P1', areaM2: '1' }), ctx).areaM2).toMatch(/leaving 0 m²/)
    expect(validateCultivation(form({ id: 'ON-P1-Cherry', greenhouseId: 'ON-P1', areaM2: '11601' }), { ...ctx, editingId: 'ON-P1-Cherry' }).areaM2).toMatch(/Too big/)
    expect(validateCultivation(form({ id: 'ON-P1-Cherry', greenhouseId: 'ON-P1', areaM2: '11600' }), { ...ctx, editingId: 'ON-P1-Cherry' })).toEqual({})
  })

  it('does not count archived cultivations towards the greenhouse area', () => {
    const archived = base.cultivations.map((c) => (c.id === 'ON-P1-TOV' ? { ...c, archived: true } : c))
    expect(validateCultivation(form({ greenhouseId: 'ON-P1', areaM2: '27400' }), { ...ctx, cultivations: archived })).toEqual({})
  })

  it('needs the planting date on or before the planned end date', () => {
    expect(validateCultivation(form({ plannedEndDate: '2026-01-04' }), ctx).plannedEndDate).toMatch(/on or after the planting date/)
    expect(validateCultivation(form({ plannedEndDate: '2026-01-05' }), ctx)).toEqual({})
    expect(validateCultivation(form({ plantingDate: '2026-02-30' }), ctx).plantingDate).toBeDefined()
    expect(validateCultivation(form({ plannedEndDate: '' }), ctx)).toEqual({})
  })

  it('needs a fruit type from the list, a variety and an area above 0', () => {
    const errors = validateCultivation(form({ fruitType: 'plum', variety: ' ', areaM2: '0' }), ctx)
    expect(Object.keys(errors).sort()).toEqual(['areaM2', 'fruitType', 'variety'])
  })

  it('checks greenhouses: unique id, area not below what is in use', () => {
    const greenhouse = { facilityId: 'ON', code: 'P2', name: 'Phase 2', areaM2: '8000', ledWattsPerM2: '' }
    expect(validateGreenhouse(greenhouse, { catalog: withP2, cultivations: base.cultivations, editingId: null }).code).toMatch(/already used/)
    expect(validateGreenhouse({ ...greenhouse, code: 'P3', name: 'Phase 3' }, { catalog: withP2, cultivations: base.cultivations, editingId: null })).toEqual({})
    expect(validateGreenhouse({ ...greenhouse, code: 'P1', name: 'Phase 1', areaM2: '38000' }, { catalog: withP2, cultivations: base.cultivations, editingId: 'ON-P1' }).areaM2).toMatch(/cannot be smaller/)
    expect(validateGreenhouse({ ...greenhouse, code: 'P3', name: 'Phase 3', ledWattsPerM2: '-5' }, { catalog: withP2, cultivations: base.cultivations, editingId: null }).ledWattsPerM2).toBeDefined()
  })

  it('checks facilities: unique name and code', () => {
    const facility = { code: 'NM', name: 'New Mexico', region: 'US', currency: 'USD' }
    expect(validateFacility(facility, { catalog, editingId: null })).toEqual({})
    expect(validateFacility({ ...facility, code: 'on' }, { catalog, editingId: null }).code).toMatch(/already used/)
    expect(validateFacility({ ...facility, name: 'ontario' }, { catalog, editingId: null }).name).toMatch(/already/)
    expect(validateFacility({ ...facility, currency: 'US' }, { catalog, editingId: null }).currency).toBeDefined()
  })
})

describe('copy budgets', () => {
  const row = (cultivation: string, kpi: string, date: string, target: number | null, actual: number | null = null): DailyRow => ({ cultivation, kpi, date, week: 'w', actual, target })
  const source = { id: 'S', plantingDate: '2025-01-01' }
  const target = { id: 'T', plantingDate: '2026-03-10' }
  const daily = [
    row('S', 'Harvest', '2025-01-01', 1), // crop day 0
    row('S', 'Harvest', '2025-01-02', 2), // crop day 1
    row('S', 'Harvest', '2025-01-03', null, 5), // no target: skipped
    row('S', 'Harvest', '2025-02-01', 3), // crop day 31
    row('S', 'Drain', '2025-01-02', 40),
    row('OTHER', 'Harvest', '2025-01-02', 99),
  ]
  const edits = budgetCopyEdits({ source, target, daily, createdBy: 'dana', createdAt: '2026-10-04T10:00:00Z' })

  it('puts the source target of crop day N on the new cultivation crop day N', () => {
    const byDate = (kpi: string) => Object.fromEntries(edits.filter((e) => e.kpi === kpi).map((e) => [e.dateFrom, e.newValue]))
    expect(byDate('Harvest')).toEqual({ '2026-03-10': 1, '2026-03-11': 2, '2026-04-10': 3 })
    expect(byDate('Drain')).toEqual({ '2026-03-11': 40 })
  })

  it('writes one-day target edits that say where they came from', () => {
    expect(edits).toHaveLength(4)
    for (const e of edits) {
      expect(e).toMatchObject({ cultivation: 'T', field: 'target', source: 'edited', reason: 'Copied from S', originalValue: null, dateFrom: e.dateTo })
    }
    expect(new Set(edits.map((e) => e.id)).size).toBe(edits.length)
  })

  it('gives the new cultivation its budgets in the merged data, with no actuals', () => {
    const added: WorkspaceCultivation = { id: 'ON-P2-TOV', facility: 'Ontario', greenhouse: 'Phase 2', crop: 'Tomato', variety: 'TOV', plantingDate: '2026-03-10', areaM2: 1000, cropWeekAtEnd: 0, fruitType: 'tov', plannedEndDate: null, archived: false }
    const real = budgetCopyEdits({ source: base.cultivations[7]!, target: added, daily: base.daily, createdBy: 'dana', createdAt: '2026-10-04T10:00:00Z' })
    const merged = merge(base, { cultivations: [added], valueEdits: real })
    const mine = merged.daily.filter((r) => r.cultivation === 'ON-P2-TOV')
    expect(mine.length).toBe(real.length)
    expect(mine.every((r) => r.actual === null && r.target !== null)).toBe(true)
    // Crop day 0 of the source is 2025-05-08; its first row in the data (2025-05-26) is crop day 18.
    const src = base.daily.find((r) => r.cultivation === 'ON-P1-TOV' && r.kpi === 'Harvest' && r.date === '2025-05-26')!
    expect(mine.find((r) => r.kpi === 'Harvest' && r.date === '2026-03-28')!.target).toBe(src.target)
    // The workbook days are untouched.
    expect(merged.daily.filter((r) => r.cultivation !== 'ON-P2-TOV')).toEqual(base.daily)
  })

  it('offers cultivations of the same fruit type that have targets', () => {
    const added = { ...base.cultivations[7]!, id: 'NEW', fruitType: 'tov' } as WorkspaceCultivation
    const ids = copySources(added, [...base.cultivations, added], new Set(base.cultivations.map((c) => c.id))).map((c) => c.id)
    expect(ids).toEqual(['PA-P1-TOV', 'PA-P2-TOV', 'ON-P1-TOV'])
    expect(copySources(added, base.cultivations, new Set(['PA-P1-TOV'])).map((c) => c.id)).toEqual(['PA-P1-TOV'])
    expect(copySources({ ...added, fruitType: 'plum', variety: 'Other' }, base.cultivations, new Set(base.cultivations.map((c) => c.id)))).toEqual([])
  })
})

describe('a cultivation with no budget', () => {
  const added: WorkspaceCultivation = { id: 'ON-P2-TOV', facility: 'Ontario', greenhouse: 'Phase 2', crop: 'Tomato', variety: 'TOV', plantingDate: '2026-03-10', areaM2: 1000, cropWeekAtEnd: 0, fruitType: 'tov', plannedEndDate: null, archived: false }

  it('is "no budget" rather than a score, and the workbook cultivations are ready', () => {
    const merged = merge(base, { cultivations: [added] })
    const states = dataStates(merged.daily)
    expect(dataStateOf(states, 'ON-P2-TOV')).toBe('no-budget')
    expect(dataStateOf(states, 'PA-P1-TOV')).toBe('ready')
    // The score itself has nothing to rate: every category is unscored, none is red, amber or green.
    const lookup = buildWeekly(applyDecisions(merged.daily, detectFlags(merged.daily, merged.cultivations), [], false))
    const score = scoreCultivationWeek(lookup, 'ON-P2-TOV', '2025-W34')
    expect(score.categories.every((c) => c.status === null)).toBe(true)
  })

  it('has budget but "no data" until something is recorded, then is ready', () => {
    const budgets = budgetCopyEdits({ source: base.cultivations[7]!, target: added, daily: base.daily, createdBy: 'd', createdAt: '2026-10-04T00:00:00Z' })
    const withBudget = merge(base, { cultivations: [added], valueEdits: budgets })
    expect(dataStateOf(dataStates(withBudget.daily), 'ON-P2-TOV')).toBe('no-data')
    const entered = { cultivation: 'ON-P2-TOV', date: '2026-03-28', kpi: 'Harvest', actual: 0.2, target: null, createdBy: 'd', createdAt: '2026-10-04T00:00:00Z', source: 'entered' as const }
    expect(dataStateOf(dataStates(merge(base, { cultivations: [added], valueEdits: budgets, enteredRows: [entered] }).daily), 'ON-P2-TOV')).toBe('ready')
  })

  it('a cultivation that is not in the data at all has no budget', () => {
    expect(dataStateOf(dataStates(base.daily), 'NOPE')).toBe('no-budget')
  })

  it('is not flagged for missing values while it has only budgets', () => {
    const budgets = budgetCopyEdits({ source: base.cultivations[7]!, target: added, daily: base.daily, createdBy: 'd', createdAt: '2026-10-04T00:00:00Z' })
    const merged = merge(base, { cultivations: [added], valueEdits: budgets })
    expect(detectFlags(merged.daily, merged.cultivations).filter((f) => f.cultivation === 'ON-P2-TOV')).toEqual([])
    expect(detectFlags(merged.daily, merged.cultivations).length).toBe(detectFlags(base.daily, base.cultivations).length)
  })

  it('the app opens on the latest week with recorded values, not on a budget-only week', () => {
    const budgets = budgetCopyEdits({ source: base.cultivations[7]!, target: added, daily: base.daily, createdBy: 'd', createdAt: '2026-10-04T00:00:00Z' })
    const merged = merge(base, { cultivations: [added], valueEdits: budgets })
    expect(merged.weeks.at(-1)!.id).not.toBe('2025-W34')
    expect(latestWeekWithActuals(merged.daily, merged.weeks)).toBe('2025-W34')
  })
})

describe('fruit types', () => {
  it('seeds the nine placeholder types while the workspace has none', () => {
    expect(effectiveFruitTypes([])).toEqual({ types: DEFAULT_FRUIT_TYPES, seeded: false })
    expect(DEFAULT_FRUIT_TYPES).toHaveLength(9)
    expect(DEFAULT_FRUIT_TYPES.every((t) => t.placeholder)).toBe(true)
    expect(DEFAULT_FRUIT_TYPES.find((t) => t.id === 'tov')).toMatchObject({ weightMinG: 80, weightMaxG: 170 })
    const stored = [{ ...DEFAULT_FRUIT_TYPES[0]!, name: 'Grape (red)' }]
    expect(effectiveFruitTypes(stored)).toEqual({ types: stored, seeded: true })
  })

  it('maps the workbook varieties to their type until a cultivation has its own', () => {
    expect(base.cultivations.map(fruitTypeIdOf)).toEqual(['tov', 'tov', 'cocktail', 'snack', 'snack', 'snack', 'cherry', 'tov'])
    expect(fruitTypeIdOf({ variety: 'TOV', fruitType: 'beef' })).toBe('beef')
    expect(fruitTypeIdOf({ variety: 'Mystery', fruitType: null })).toBeNull()
  })

  it('blocks removing a type that is in use and names the cultivations', () => {
    const message = removalBlock({ id: 'tov', name: 'TOV' }, base.cultivations)
    expect(message).toContain('PA-P1-TOV')
    expect(message).toContain('ON-P1-TOV')
    expect(removalBlock({ id: 'plum', name: 'Plum' }, base.cultivations)).toBeNull()
    // Moving a cultivation to another type frees the old one.
    const moved = base.cultivations.map((c) => (c.id === 'PA-P3-Cocktail' ? { ...c, fruitType: 'plum' } : c))
    expect(removalBlock({ id: 'cocktail', name: 'Cocktail' }, moved)).toBeNull()
    expect(cultivationsUsing('plum', moved).map((c) => c.id)).toEqual(['PA-P3-Cocktail'])
  })

  it('checks a weight against the range: under, within or over', () => {
    const cocktail = { weightMinG: 30, weightMaxG: 50 }
    expect(specCheck(29.9, cocktail)).toBe('under')
    expect(specCheck(30, cocktail)).toBe('within')
    expect(specCheck(42, cocktail)).toBe('within')
    expect(specCheck(50, cocktail)).toBe('within')
    expect(specCheck(50.1, cocktail)).toBe('over')
    expect(weightRangeText(cocktail)).toBe('30–50 g')
  })

  it('averages the measured weekly weights and skips weeks without one', () => {
    const values: Record<string, number | null> = { 'A|w1': 10, 'A|w2': null, 'B|w1': 20, 'B|w2': 30 }
    expect(measuredFruitWeight(['A', 'B'], ['w1', 'w2'], (c, w) => values[`${c}|${w}`])).toBe(20)
    expect(measuredFruitWeight([], ['w1'], () => 1)).toBeNull()
    expect(measuredFruitWeight(['A'], ['w2'], (c, w) => values[`${c}|${w}`])).toBeNull()
  })

  it('saves the defaults along with the first change, and only the change after that', () => {
    const changed = { ...DEFAULT_FRUIT_TYPES.find((t) => t.id === 'plum')!, pricePerKg: 2.5, placeholder: false }
    const first = itemsToSave([], changed)
    expect(first).toHaveLength(9)
    expect(first.filter((t) => t.id === 'plum')).toEqual([changed])
    expect(itemsToSave(first, changed)).toEqual([changed])
  })

  it('makes unique ids and checks the form text', () => {
    expect(fruitTypeId('Grape on the vine', [])).toBe('grape-on-the-vine')
    expect(fruitTypeId('TOV', ['tov'])).toBe('tov-2')
    const ok = { name: 'Mini plum', weightMinG: '20', weightMaxG: '30', diameterMinMm: '', diameterMaxMm: '', pricePerKg: '' }
    expect(validateFruitType(ok, DEFAULT_FRUIT_TYPES)).toEqual({})
    expect(validateFruitType({ ...ok, name: 'plum' }, DEFAULT_FRUIT_TYPES).name).toMatch(/already/)
    expect(validateFruitType({ ...ok, weightMinG: '40' }, []).weightMaxG).toMatch(/not be below/)
    expect(validateFruitType({ ...ok, diameterMinMm: '20' }, []).diameterMaxMm).toMatch(/both/)
    expect(validateFruitType({ ...ok, pricePerKg: '-1' }, []).pricePerKg).toBeDefined()
  })
})
