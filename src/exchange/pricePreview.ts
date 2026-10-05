// What a market price file would do, worked out before anything is saved: which prices change (old to new), which are
// the same already, which rows are problems, and which commodities the app does not know (each can be created with the
// import). Then the rows to save. Pure.

import { fixed } from '../lib/format'
import { fruitTypeId } from '../setup/fruitTypes'
import type { FruitType, PriceSourceNote, Rates } from '../workspace/types'
import type { PriceParseResult, PriceRow } from './priceFile'
import type { ImportProblem } from './parse'

/** The weight range a commodity created by a price import starts with, marked as a placeholder until the real specs are entered. */
export const NEW_COMMODITY_WEIGHT_G = { min: 1, max: 500 }

export interface PriceContext {
  /** The fruit types in use (the workspace's, or the defaults). */
  types: FruitType[]
  /** Whether those are stored in the workspace; if not, the first save keeps all of them. */
  seeded: boolean
  facilities: { id: string; name: string; currency: string }[]
  rates: Rates[]
  /** The currency of a price with no facility. */
  appCurrency: string
}

export interface PriceChange {
  row: PriceRow
  typeId: string
  typeName: string
  /** The facility this price is for; null for the general price of the commodity. */
  facilityId: string | null
  facilityName: string | null
  /** The price now: the facility's own one, or the commodity's general one. null when none is entered. */
  before: number | null
  after: number
  /** True when the commodity is created by this import. */
  newCommodity: boolean
}

export interface UnknownCommodity {
  /** The name as first written, and its lower-case form that identifies it. */
  name: string
  key: string
  lines: number[]
  create: boolean
}

export interface PricePreview {
  changes: PriceChange[]
  /** Rows whose price is the same as now; they are skipped. */
  unchanged: PriceRow[]
  problems: ImportProblem[]
  unknown: UnknownCommodity[]
  /** Rows of unknown commodities that are not created, so left out. */
  skipped: number
}

const norm = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
const SAME_WITHIN = 1e-9

/** The change in percent of the old price; null when there is no old price or it is 0. */
export const changePercent = (before: number | null, after: number): number | null => (before === null || before === 0 ? null : ((after - before) / before) * 100)

/** "2.50 → 2.80 (+12.0%)", or "no price → 2.80". */
export function changeText(before: number | null, after: number): string {
  const pct = changePercent(before, after)
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')
  return `${before === null ? 'no price' : fixed(before, 2)} → ${fixed(after, 2)}${pct === null ? '' : ` (${sign(pct)}${fixed(Math.abs(pct), 1)}%)`}`
}

/**
 * Compare the file with the prices as they are now. `create` holds the lower-case names of unknown commodities to create;
 * their rows then count as changes, and the rest are left out. A commodity or facility is found by its name or its id,
 * whatever the case. A commodity and facility listed twice: the first valid row is used.
 */
export function previewPrices(parsed: PriceParseResult, ctx: PriceContext, create: ReadonlySet<string> = new Set()): PricePreview {
  const preview: PricePreview = { changes: [], unchanged: [], problems: [...parsed.problems], unknown: [], skipped: 0 }
  const typeBy = new Map<string, FruitType>()
  for (const t of ctx.types) {
    typeBy.set(norm(t.id), t)
    typeBy.set(norm(t.name), t)
  }
  const facilityBy = new Map<string, PriceContext['facilities'][number]>()
  for (const f of ctx.facilities) {
    facilityBy.set(norm(f.id), f)
    facilityBy.set(norm(f.name), f)
  }
  const taken = ctx.types.map((t) => t.id)
  const created = new Map<string, { id: string; name: string }>()
  const unknown = new Map<string, UnknownCommodity>()
  const firstLine = new Map<string, number>()
  const problem = (line: number, text: string) => preview.problems.push({ line, message: `Row ${line}: ${text}` })

  for (const row of parsed.rows) {
    const facility = row.facility === '' ? null : (facilityBy.get(norm(row.facility)) ?? null)
    if (row.facility !== '' && !facility) {
      problem(row.line, `unknown facility "${row.facility}". Left out.`)
      continue
    }
    const expected = facility?.currency ?? ctx.appCurrency
    if (row.currency !== '' && row.currency !== expected.toUpperCase()) {
      problem(row.line, `the currency is ${row.currency}, but ${facility ? facility.name : 'the app'} uses ${expected}. Left out.`)
      continue
    }

    const known = typeBy.get(norm(row.commodity))
    const key = norm(row.commodity)
    const dupKey = `${known ? known.id : `new:${key}`}|${facility?.id ?? ''}`
    const first = firstLine.get(dupKey)
    if (first !== undefined) {
      problem(row.line, `${row.commodity}${facility ? `, ${facility.name}` : ''} is already on row ${first}. Only the first one is used.`)
      continue
    }
    firstLine.set(dupKey, row.line)

    let type: { id: string; name: string } | undefined = known
    if (!known) {
      let entry = unknown.get(key)
      if (!entry) {
        entry = { name: row.commodity, key, lines: [], create: create.has(key) }
        unknown.set(key, entry)
      }
      entry.lines.push(row.line)
      if (!entry.create) {
        preview.skipped++
        continue
      }
      if (!created.has(key)) {
        const id = fruitTypeId(row.commodity, taken)
        taken.push(id)
        created.set(key, { id, name: row.commodity })
      }
      type = created.get(key)
    }

    const before = known ? (facility ? (ctx.rates.find((r) => r.facilityId === facility.id)?.priceOverrides?.[known.id] ?? null) : known.pricePerKg) : null
    if (before !== null && Math.abs(before - row.pricePerKg) <= SAME_WITHIN) {
      preview.unchanged.push(row)
      continue
    }
    preview.changes.push({ row, typeId: type!.id, typeName: type!.name, facilityId: facility?.id ?? null, facilityName: facility?.name ?? null, before, after: row.pricePerKg, newCommodity: !known })
  }
  preview.unknown = [...unknown.values()]
  return preview
}

/** What to save for an import: the fruit types that are created or get a new general price, and the facility price rows. */
export interface PriceSave {
  fruitTypes: FruitType[]
  rates: Rates[]
  /** Names of the commodities created. */
  created: string[]
}

/**
 * The rows to save. A general price goes on the fruit type and a facility's price in that facility's overrides, each with a
 * note of where it came from. While the workspace holds no fruit types, all of them are returned so the first save keeps them.
 */
export function toPriceSave(preview: PricePreview, ctx: PriceContext, meta: { importedBy: string; importedAt: string }): PriceSave {
  const types = new Map(ctx.types.map((t) => [t.id, t]))
  const touched = new Set<string>()
  const created: string[] = []
  const rates = new Map<string, Rates>()
  const noteOf = (row: PriceRow): PriceSourceNote => ({ kind: 'market', date: row.date, importedBy: meta.importedBy, importedAt: meta.importedAt })

  for (const change of preview.changes) {
    if (change.newCommodity && !types.has(change.typeId)) {
      types.set(change.typeId, {
        id: change.typeId,
        name: change.typeName,
        weightMinG: NEW_COMMODITY_WEIGHT_G.min,
        weightMaxG: NEW_COMMODITY_WEIGHT_G.max,
        diameterMinMm: null,
        diameterMaxMm: null,
        pricePerKg: null,
        priceSource: null,
        placeholder: true,
      })
      created.push(change.typeName)
      touched.add(change.typeId)
    }
    if (change.facilityId === null) {
      types.set(change.typeId, { ...types.get(change.typeId)!, pricePerKg: change.after, priceSource: noteOf(change.row) })
      touched.add(change.typeId)
    } else {
      const base: Rates = rates.get(change.facilityId) ?? ctx.rates.find((r) => r.facilityId === change.facilityId) ?? { facilityId: change.facilityId, heatPerKwh: null, electricityPerKwh: null, waterPerM3: null, priceOverrides: null, updatedBy: null, updatedAt: null }
      rates.set(change.facilityId, {
        ...base,
        priceOverrides: { ...(base.priceOverrides ?? {}), [change.typeId]: change.after },
        priceSources: { ...(base.priceSources ?? {}), [change.typeId]: noteOf(change.row) },
        updatedBy: meta.importedBy || null,
        updatedAt: meta.importedAt,
      })
    }
  }
  // Created commodities that only had facility prices are touched above; a row of a new type keeps its place in file order.
  const all = [...types.values()]
  return { fruitTypes: ctx.seeded ? all.filter((t) => touched.has(t.id)) : touched.size > 0 ? all : [], rates: [...rates.values()], created }
}
