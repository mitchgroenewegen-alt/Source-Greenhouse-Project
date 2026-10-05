// Shapes shared by the data-preparation script and the app.

/** How a KPI adds up over a week (from the "KPI dictionary" in the Read me sheet). */
export type Aggregation = 'sum' | 'average' | 'last'

export type Category = 'Production' | 'Plant' | 'Climate' | 'Irrigation' | 'Resource usage'

export interface Cultivation {
  id: string // e.g. "PA-P1-TOV"
  facility: string // "Pennsylvania" | "Arizona" | "Ontario"
  greenhouse: string // "Phase 1"
  crop: string
  variety: string
  plantingDate: string // ISO date, e.g. "2024-10-14"
  areaM2: number
  /** Crop week on the last day of the period, as given in the Greenhouses sheet. */
  cropWeekAtEnd: number
  /** Only on cultivations that come from the workspace (set up or edited in the app). */
  fruitType?: string | null
  plannedEndDate?: string | null
  /** Kept in the data so history stays, but no longer a live cultivation. */
  archived?: boolean
}

/** One line of the KPI dictionary. */
export interface KpiDictionaryEntry {
  name: string
  category: Category
  unit: string
  definition: string
  /** Text exactly as in the Read me sheet, e.g. "Last value of the week". */
  aggregationText: string
  aggregation: Aggregation
}

/** One cell pair of the KPIs sheet. `null` means "not recorded" (never zero). */
export interface DailyRow {
  date: string // ISO date
  week: string // ISO week, e.g. "2025-W34"
  cultivation: string
  kpi: string
  actual: number | null
  target: number | null
  /**
   * 1-based Excel row of this day in the workbook's KPIs sheet (the header is row 1). Only on rows read from the
   * workbook; days typed in or imported in the app have none.
   */
  row?: number
}

/** One cultivation, one KPI, one week, rolled up with the KPI's own aggregation rule. */
export interface WeeklyRow {
  week: string
  cultivation: string
  kpi: string
  actual: number | null
  target: number | null
  /** Number of days that went into the roll-up. */
  days: number
}

export interface WeekInfo {
  id: string // "2025-W34"
  start: string // Monday
  end: string // Sunday
}

export interface DataFile {
  meta: {
    source: string
    periodStart: string
    periodEnd: string
    dayCount: number
    weekCount: number
    kpiCount: number
    cultivationCount: number
  }
  weeks: WeekInfo[]
  cultivations: Cultivation[]
  kpis: KpiDictionaryEntry[]
  daily: DailyRow[]
  weekly: WeeklyRow[]
}
