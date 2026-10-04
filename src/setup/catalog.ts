// The facilities and greenhouses the Setup screen lists. The workbook has no facility or greenhouse sheet of its own
// (only cultivations, each naming its facility and greenhouse), so the workbook ones are worked out from the
// cultivations' ids: PA-P1-TOV gives facility PA and greenhouse PA-P1. A workspace record with the same id (an edit,
// such as the greenhouse's area) is laid over them; records with another id are facilities and greenhouses added in the app.

import type { Cultivation } from '../data/types'
import type { Facility, Greenhouse } from '../workspace/types'

export interface FacilityEntry extends Facility {
  /** True for the ones the workbook's cultivations imply; their name cannot be changed. */
  fromWorkbook: boolean
}

export interface GreenhouseEntry extends Greenhouse {
  /** The part of the id after the facility code ("P1" in PA-P1). */
  code: string
  facilityName: string
  fromWorkbook: boolean
}

export interface Catalog {
  facilities: FacilityEntry[]
  greenhouses: GreenhouseEntry[]
}

export const DEFAULT_CURRENCY = 'USD'

export function buildCatalog(
  workbook: Cultivation[],
  stored: { facilities: Facility[]; greenhouses: Greenhouse[] },
): Catalog {
  const facilities = new Map<string, FacilityEntry>()
  const greenhouses = new Map<string, GreenhouseEntry>()

  for (const c of workbook) {
    const [facilityCode = '', greenhouseCode = ''] = c.id.split('-')
    if (!facilities.has(facilityCode)) {
      facilities.set(facilityCode, { id: facilityCode, name: c.facility, region: '', currency: DEFAULT_CURRENCY, fromWorkbook: true })
    }
    const id = `${facilityCode}-${greenhouseCode}`
    const known = greenhouses.get(id)
    if (known) known.areaM2 += c.areaM2 // the workbook gives no greenhouse area: the cultivations in it fill it
    else {
      greenhouses.set(id, { id, facilityId: facilityCode, name: c.greenhouse, areaM2: c.areaM2, ledWattsPerM2: null, code: greenhouseCode, facilityName: c.facility, fromWorkbook: true })
    }
  }

  for (const f of stored.facilities) {
    facilities.set(f.id, { ...f, fromWorkbook: facilities.get(f.id)?.fromWorkbook ?? false })
  }
  for (const g of stored.greenhouses) {
    const workbookOne = greenhouses.get(g.id)
    const facility = facilities.get(g.facilityId)
    greenhouses.set(g.id, {
      ...g,
      code: g.id.startsWith(`${g.facilityId}-`) ? g.id.slice(g.facilityId.length + 1) : g.id,
      facilityName: facility?.name ?? g.facilityId,
      fromWorkbook: workbookOne?.fromWorkbook ?? false,
    })
  }
  return { facilities: [...facilities.values()], greenhouses: [...greenhouses.values()] }
}

/** The greenhouse a cultivation grows in. A cultivation names its facility and greenhouse by name. */
export function greenhouseOf(c: Pick<Cultivation, 'facility' | 'greenhouse'>, catalog: Catalog): GreenhouseEntry | undefined {
  return catalog.greenhouses.find((g) => g.facilityName === c.facility && g.name === c.greenhouse)
}

/** Cultivations in a greenhouse that still count towards its area: archived ones have left it. */
export function liveCultivationsIn(greenhouse: GreenhouseEntry, cultivations: Cultivation[]): Cultivation[] {
  return cultivations.filter((c) => !c.archived && c.facility === greenhouse.facilityName && c.greenhouse === greenhouse.name)
}
