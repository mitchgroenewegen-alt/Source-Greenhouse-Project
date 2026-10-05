import type { Cultivation } from '../data/types'
import type { Decision } from '../storage/types'

export interface Facility {
  id: string
  name: string
  region: string
  currency: string // default 'USD'
}

export interface Greenhouse {
  id: string
  facilityId: string
  name: string
  areaM2: number
  ledWattsPerM2: number | null
}

/** A cultivation added or edited in the app: everything the workbook gives, plus what only the app knows. */
export interface WorkspaceCultivation extends Cultivation {
  fruitType: string | null // id of a fruit type
  plannedEndDate: string | null
  archived: boolean
}

export type ValueSource = 'edited' | 'corrected' | 'entered' | 'imported'

/** One change to actual or target over a range of days. The workbook itself is never touched. */
export interface ValueEdit {
  id: string
  cultivation: string
  kpi: string
  dateFrom: string
  dateTo: string
  field: 'actual' | 'target'
  newValue: number
  originalValue: number | null
  createdBy: string
  createdAt: string // ISO timestamp
  reason: string
  source: ValueSource
}

/** A day typed in by hand (or imported). Replaces the workbook's cell for the same date, cultivation and KPI. */
export interface EnteredRow {
  cultivation: string
  date: string
  kpi: string
  actual: number | null
  target: number | null
  createdBy: string
  createdAt: string
  source: ValueSource
}

/**
 * One reading of a climate computer export: a parameter (such as "Temperature") at a moment, with the value the house
 * realised and the setpoint it was steered to. The workbook only has daily values, so this is the finer data of step 7.
 */
export interface ClimateReading {
  cultivation: string
  /** Parameter name as written in the file; free text ("Temperature", "Humidity", "CO2"). Never contains "|". */
  parameter: string
  /** Local time as in the file, to the minute: "2025-08-20T14:30". No time zone is applied or guessed. */
  timestamp: string
  value: number
  /** null when the file had no setpoint for this reading. */
  setpoint: number | null
  createdBy: string
  createdAt: string
}

/** Where a price came from: a market price file, the date the price is for, and who brought it in and when. A price typed in by hand has none. */
export interface PriceSourceNote {
  kind: 'market'
  /** The date (YYYY-MM-DD) the market price is for. */
  date: string
  importedBy: string
  /** ISO timestamp of the import. */
  importedAt: string
}

export interface FruitType {
  id: string
  name: string
  weightMinG: number
  weightMaxG: number
  diameterMinMm: number | null
  diameterMaxMm: number | null
  pricePerKg: number | null
  /** Where `pricePerKg` came from when it was imported; null or absent for a price typed in. */
  priceSource?: PriceSourceNote | null
  /** True while the numbers are a stand-in until someone enters the real ones. */
  placeholder: boolean
}

/**
 * What a facility pays for energy and water, and the prices it gets that differ from the fruit type's price.
 * null means "not entered yet". Money is in the facility's currency.
 */
export interface Rates {
  facilityId: string
  heatPerKwh: number | null
  electricityPerKwh: number | null
  waterPerM3: number | null
  /** Price per kg for this facility by fruit type id, where it differs from the fruit type's own price. null: no overrides. */
  priceOverrides: Record<string, number> | null
  /** Where an overridden price came from when it was imported, by fruit type id. Entries for prices typed in are absent. */
  priceSources?: Record<string, PriceSourceNote> | null
  /** Who last changed this row and when (ISO timestamp); null on a row saved before these were kept. */
  updatedBy: string | null
  updatedAt: string | null
}

/** Everything the app keeps beyond the workbook. */
export interface WorkspaceData {
  facilities: Facility[]
  greenhouses: Greenhouse[]
  cultivations: WorkspaceCultivation[]
  valueEdits: ValueEdit[]
  enteredRows: EnteredRow[]
  climateReadings: ClimateReading[]
  fruitTypes: FruitType[]
  rates: Rates[]
  decisions: Decision[]
}

export type EntityName = keyof WorkspaceData

/** The one field (or the fields joined with "|") that tells two items of an entity apart. */
export const ENTITY_KEY: { [K in EntityName]: (item: WorkspaceData[K][number]) => string } = {
  facilities: (x) => x.id,
  greenhouses: (x) => x.id,
  cultivations: (x) => x.id,
  valueEdits: (x) => x.id,
  enteredRows: (x) => `${x.cultivation}|${x.kpi}|${x.date}`,
  climateReadings: (x) => `${x.cultivation}|${x.parameter}|${x.timestamp}`,
  fruitTypes: (x) => x.id,
  rates: (x) => x.facilityId,
  decisions: (x) => x.cellId,
}

export const ENTITIES = Object.keys(ENTITY_KEY) as EntityName[]

export function emptyWorkspace(): WorkspaceData {
  return { facilities: [], greenhouses: [], cultivations: [], valueEdits: [], enteredRows: [], climateReadings: [], fruitTypes: [], rates: [], decisions: [] }
}

/**
 * local: kept in this browser (no shared database set up). online: the shared database, signed in.
 * offline-readonly: the shared database could not be reached; showing the last saved copy.
 * signed-out: the shared database is set up but nobody is signed in; only the workbook is shown.
 */
export type WorkspaceStatus = 'local' | 'online' | 'offline-readonly' | 'signed-out'

/** What the screens read. A new object after every change, so it can be used as a React snapshot. */
export interface WorkspaceSnapshot {
  data: WorkspaceData
  status: WorkspaceStatus
  /** Email of the signed-in person; null when nobody is (or there is no shared database). */
  user: string | null
  /** False until the first load has finished. */
  ready: boolean
}

/** Where the workspace lives. The screens only know this interface. */
export interface WorkspaceStore {
  /** Load what is stored (and connect, for the shared database). Resolves when `snapshot().ready` is true. */
  start(): Promise<void>
  snapshot(): WorkspaceSnapshot
  /** Add items, replacing any earlier item with the same key. Rejects when the store is read-only. */
  save<K extends EntityName>(entity: K, items: WorkspaceData[K]): Promise<void>
  /** Delete the items with these keys (see ENTITY_KEY). */
  remove(entity: EntityName, keys: string[]): Promise<void>
  /** Call back after every change. Returns the function that stops listening. */
  subscribe(listener: () => void): () => void
  /** False when the browser would not let us keep decisions beyond this tab. */
  readonly persistent: boolean
  /** Stop listening to the network. */
  dispose(): void
}

/** Thrown by save and remove while signed out or offline. */
export class WorkspaceReadOnlyError extends Error {
  constructor(readonly status: WorkspaceStatus) {
    super(status === 'signed-out' ? 'Sign in to make changes.' : "Can't save while the shared database is out of reach.")
  }
}

export function isWritable(status: WorkspaceStatus): boolean {
  return status === 'local' || status === 'online'
}
