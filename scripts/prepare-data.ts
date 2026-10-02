// Reads data/Perfect-Produce-Growing-Data.xlsx and writes public/data.json.
// Run with `npm run prepare-data` (it also runs automatically before dev, build and test).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as XLSX from 'xlsx'
import { rollup } from '../src/data/aggregate.ts'
import { KPI_CONFIG } from '../src/config/kpis.ts'
import { cropWeekOn, excelSerialToIso, addDays, isoWeekOf } from '../src/data/dates.ts'
import type {
  Aggregation,
  Category,
  Cultivation,
  DailyRow,
  DataFile,
  KpiDictionaryEntry,
  WeekInfo,
  WeeklyRow,
} from '../src/data/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const XLSX_PATH = resolve(ROOT, 'data/Perfect-Produce-Growing-Data.xlsx')
const OUTPUT_PATH = resolve(ROOT, 'public/data.json')

type Cell = string | number | null

const CATEGORIES: Category[] = ['Production', 'Plant', 'Climate', 'Irrigation', 'Resource usage']

function sheetRows(workbook: XLSX.WorkBook, name: string): Cell[][] {
  const sheet = workbook.Sheets[name]
  if (!sheet) throw new Error(`Sheet "${name}" not found in the workbook`)
  // raw: true keeps dates as Excel serial numbers; we convert them ourselves (no timezone involved).
  return XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null })
}

function asText(cell: Cell | undefined): string {
  return cell === null || cell === undefined ? '' : String(cell).trim()
}

/** An empty cell is "not recorded" and stays null; it is never turned into zero. */
function asNumber(cell: Cell | undefined, where: string): number | null {
  if (cell === null || cell === undefined || cell === '') return null
  if (typeof cell === 'number') return cell
  const parsed = Number(String(cell).replace(',', '.'))
  if (Number.isNaN(parsed)) throw new Error(`${where}: "${cell}" is not a number`)
  return parsed
}

function asIsoDate(cell: Cell | undefined, where: string): string {
  if (typeof cell === 'number') return excelSerialToIso(cell)
  const text = asText(cell)
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  throw new Error(`${where}: cannot read "${cell}" as a date`)
}

function parseAggregation(text: string): Aggregation {
  const t = text.toLowerCase()
  if (t.startsWith('sum')) return 'sum'
  if (t.startsWith('average')) return 'average'
  if (t.startsWith('last value')) return 'last' // also covers "Last value of the week" (Waste)
  throw new Error(`Unknown aggregation rule in the KPI dictionary: "${text}"`)
}

function readKpiDictionary(workbook: XLSX.WorkBook): KpiDictionaryEntry[] {
  const rows = sheetRows(workbook, 'Read me')
  const header = rows.findIndex((r) => asText(r[0]) === 'KPI' && asText(r[1]) === 'Category')
  if (header < 0) throw new Error('KPI dictionary not found in the Read me sheet')
  const entries: KpiDictionaryEntry[] = []
  for (const row of rows.slice(header + 1)) {
    const name = asText(row[0])
    if (!name) break
    const category = asText(row[1]) as Category
    if (!CATEGORIES.includes(category)) throw new Error(`KPI "${name}": unknown category "${category}"`)
    const aggregationText = asText(row[4])
    entries.push({
      name,
      category,
      unit: asText(row[2]),
      definition: asText(row[3]),
      aggregationText,
      aggregation: parseAggregation(aggregationText),
    })
  }
  return entries
}

function readCultivations(workbook: XLSX.WorkBook): Cultivation[] {
  const rows = sheetRows(workbook, 'Greenhouses')
  const header = rows[0]!.map(asText)
  const col = (name: string) => {
    const i = header.findIndex((h) => h.startsWith(name))
    if (i < 0) throw new Error(`Greenhouses sheet has no "${name}" column`)
    return i
  }
  const c = {
    facility: col('Facility'),
    greenhouse: col('Greenhouse'),
    cultivation: col('Cultivation'),
    crop: col('Crop'),
    variety: col('Variety'),
    planting: col('Planting date'),
    area: col('Growing area'),
    cropWeek: col('Crop week'),
  }
  return rows
    .slice(1)
    .filter((r) => asText(r[c.cultivation]))
    .map((r) => ({
      id: asText(r[c.cultivation]),
      facility: asText(r[c.facility]),
      greenhouse: asText(r[c.greenhouse]),
      crop: asText(r[c.crop]),
      variety: asText(r[c.variety]),
      plantingDate: asIsoDate(r[c.planting] ?? null, 'Greenhouses planting date'),
      areaM2: asNumber(r[c.area] ?? null, 'Greenhouses growing area') ?? 0,
      cropWeekAtEnd: asNumber(r[c.cropWeek] ?? null, 'Greenhouses crop week') ?? 0,
    }))
}

function readDailyRows(
  workbook: XLSX.WorkBook,
  cultivations: Cultivation[],
  dictionary: KpiDictionaryEntry[],
): DailyRow[] {
  const rows = sheetRows(workbook, 'KPIs')
  const header = rows[0]!.map(asText)
  const col = (name: string) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`KPIs sheet has no "${name}" column`)
    return i
  }
  const c = {
    date: col('Date'),
    week: col('ISO week'),
    cultivation: col('Cultivation'),
    kpi: col('KPI'),
    category: col('KPI category'),
    unit: col('Unit'),
    actual: col('Actual'),
    target: col('Target'),
  }
  const cultivationIds = new Set(cultivations.map((x) => x.id))
  const dictionaryByName = new Map(dictionary.map((k) => [k.name, k]))
  const seen = new Set<string>()
  const out: DailyRow[] = []

  rows.slice(1).forEach((r, i) => {
    if (r.every((cell) => cell === null)) return
    const where = `KPIs row ${i + 2}`
    const date = asIsoDate(r[c.date] ?? null, where)
    const cultivation = asText(r[c.cultivation] ?? null)
    const kpi = asText(r[c.kpi] ?? null)
    const entry = dictionaryByName.get(kpi)
    if (!cultivationIds.has(cultivation)) throw new Error(`${where}: unknown cultivation "${cultivation}"`)
    if (!entry) throw new Error(`${where}: KPI "${kpi}" is not in the KPI dictionary`)
    if (asText(r[c.category] ?? null) !== entry.category) throw new Error(`${where}: category mismatch for "${kpi}"`)
    if (asText(r[c.unit] ?? null) !== entry.unit) throw new Error(`${where}: unit mismatch for "${kpi}"`)
    const week = asText(r[c.week] ?? null)
    if (week !== isoWeekOf(date)) throw new Error(`${where}: ISO week ${week} does not match date ${date}`)
    const key = `${cultivation}|${kpi}|${date}`
    if (seen.has(key)) throw new Error(`${where}: duplicate row for ${key}`)
    seen.add(key)
    out.push({
      date,
      week,
      cultivation,
      kpi,
      actual: asNumber(r[c.actual] ?? null, `${where} Actual`),
      target: asNumber(r[c.target] ?? null, `${where} Target`),
    })
  })

  const cultivationOrder = new Map(cultivations.map((x, i) => [x.id, i]))
  const kpiOrder = new Map(dictionary.map((k, i) => [k.name, i]))
  out.sort(
    (a, b) =>
      cultivationOrder.get(a.cultivation)! - cultivationOrder.get(b.cultivation)! ||
      kpiOrder.get(a.kpi)! - kpiOrder.get(b.kpi)! ||
      a.date.localeCompare(b.date),
  )
  return out
}

function buildWeeks(daily: DailyRow[]): WeekInfo[] {
  const ids = [...new Set(daily.map((r) => r.week))].sort()
  return ids.map((id) => {
    const dates = daily.filter((r) => r.week === id).map((r) => r.date).sort()
    // ISO weeks run Monday to Sunday; work out the Monday from any date in the week.
    const first = dates[0]!
    const dayOfWeek = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
    const start = addDays(first, -dayOfWeek)
    return { id, start, end: addDays(start, 6) }
  })
}

function buildWeekly(daily: DailyRow[], dictionary: KpiDictionaryEntry[]): WeeklyRow[] {
  const rule = new Map(dictionary.map((k) => [k.name, k.aggregation]))
  const groups = new Map<string, DailyRow[]>()
  for (const row of daily) {
    const key = `${row.cultivation}|${row.kpi}|${row.week}`
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }
  const weekly: WeeklyRow[] = []
  for (const rows of groups.values()) {
    const first = rows[0]!
    const result = rollup(rows, rule.get(first.kpi)!)
    weekly.push({
      week: first.week,
      cultivation: first.cultivation,
      kpi: first.kpi,
      actual: result.actual,
      target: result.target,
      days: result.days,
    })
  }
  return weekly // already in cultivation, KPI, week order because `daily` is sorted
}

/** The scoring config (src/config/kpis.ts) must describe the same KPIs as the workbook's dictionary. */
function checkConfigMatchesDictionary(dictionary: KpiDictionaryEntry[]) {
  const config = new Map(KPI_CONFIG.map((k) => [k.name, k]))
  for (const entry of dictionary) {
    const c = config.get(entry.name)
    if (!c) throw new Error(`KPI "${entry.name}" is in the workbook but not in src/config/kpis.ts`)
    if (c.category !== entry.category || c.unit !== entry.unit || c.aggregation !== entry.aggregation) {
      throw new Error(`KPI "${entry.name}": src/config/kpis.ts disagrees with the workbook dictionary (category, unit or aggregation)`)
    }
  }
  const known = new Set(dictionary.map((k) => k.name))
  for (const c of KPI_CONFIG) {
    if (!known.has(c.name)) throw new Error(`KPI "${c.name}" is in src/config/kpis.ts but not in the workbook`)
  }
}

/** Parse the workbook into the data file the app loads. Throws if the workbook is not as expected. */
export function buildData(xlsxPath: string = XLSX_PATH): DataFile {
  const workbook = XLSX.read(readFileSync(xlsxPath), { type: 'buffer' })
  const dictionary = readKpiDictionary(workbook)
  checkConfigMatchesDictionary(dictionary)
  const cultivations = readCultivations(workbook)
  const daily = readDailyRows(workbook, cultivations, dictionary)
  const weeks = buildWeeks(daily)
  const weekly = buildWeekly(daily, dictionary)
  const dates = [...new Set(daily.map((r) => r.date))].sort()
  const periodEnd = dates[dates.length - 1]!

  for (const c of cultivations) {
    const computed = cropWeekOn(c.plantingDate, periodEnd)
    if (computed !== c.cropWeekAtEnd) {
      throw new Error(`${c.id}: crop week on ${periodEnd} is ${computed} by date, ${c.cropWeekAtEnd} in the sheet`)
    }
  }

  return {
    meta: {
      source: 'Perfect-Produce-Growing-Data.xlsx',
      periodStart: dates[0]!,
      periodEnd,
      dayCount: dates.length,
      weekCount: weeks.length,
      kpiCount: dictionary.length,
      cultivationCount: cultivations.length,
    },
    weeks,
    cultivations,
    kpis: dictionary,
    daily,
    weekly,
  }
}

function main() {
  const data = buildData()
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(data))
  const m = data.meta
  console.log(
    `prepare-data: ${m.cultivationCount} cultivations, ${m.kpiCount} KPIs, ${m.dayCount} days ` +
      `(${m.periodStart} to ${m.periodEnd}), ${m.weekCount} weeks (${data.weeks[0]!.id} to ${data.weeks.at(-1)!.id}), ` +
      `${data.daily.length} daily rows, ${data.weekly.length} weekly rows -> public/data.json`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
