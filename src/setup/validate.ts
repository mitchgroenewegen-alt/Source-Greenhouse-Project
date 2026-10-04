// Checks for the Setup forms. Each returns the error message for each field that is wrong (an empty object when all is fine),
// so the form can show the message next to the field.

import type { Cultivation } from '../data/types'
import { addDays } from '../data/dates'
import { fixed } from '../lib/format'
import { liveCultivationsIn, type Catalog, type GreenhouseEntry } from './catalog'
import { isValidId } from './codes'

export type Errors = Record<string, string>

/** How long a crop is planned to run when no end date is typed: 48 weeks from planting. */
export const DEFAULT_CROP_WEEKS = 48
export const defaultPlannedEnd = (plantingDate: string) => addDays(plantingDate, DEFAULT_CROP_WEEKS * 7)

const AREA_SLACK = 1e-6

export function isIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  return addDays(text, 0) === text // 2025-02-30 would come back as 2025-03-02
}

const toNumber = (text: string) => (text.trim() === '' ? NaN : Number(text))

/** Area used by the live cultivations of a greenhouse (leaving out `exceptId`, the one being edited) and what is left. */
export function areaLeft(greenhouse: GreenhouseEntry, cultivations: Cultivation[], exceptId: string | null = null) {
  const used = liveCultivationsIn(greenhouse, cultivations)
    .filter((c) => c.id !== exceptId)
    .reduce((sum, c) => sum + c.areaM2, 0)
  return { used, free: greenhouse.areaM2 - used }
}

export interface CultivationForm {
  id: string
  greenhouseId: string
  fruitType: string
  variety: string
  plantingDate: string
  plannedEndDate: string
  areaM2: string
}

export interface CultivationContext {
  catalog: Catalog
  /** Every cultivation, archived ones too (an archived one still owns its id). */
  cultivations: Cultivation[]
  fruitTypeIds: string[]
  /** The id of the cultivation being edited; null when adding. */
  editingId: string | null
  /** False when this is an archived cultivation being edited without coming back: it takes no room in the greenhouse. */
  live?: boolean
}

export function validateCultivation(form: CultivationForm, ctx: CultivationContext): Errors {
  const errors: Errors = {}
  const greenhouse = ctx.catalog.greenhouses.find((g) => g.id === form.greenhouseId)
  if (!greenhouse) errors.greenhouseId = 'Choose a greenhouse.'
  if (!form.fruitType || !ctx.fruitTypeIds.includes(form.fruitType)) errors.fruitType = 'Choose a fruit type.'
  if (!form.variety.trim()) errors.variety = 'Enter the variety.'

  const id = form.id.trim()
  if (!id) errors.id = 'Enter an id.'
  else if (!isValidId(id)) errors.id = 'Use letters, digits and dashes only, for example ON-P2-TOV.'
  else if (ctx.editingId === null || ctx.editingId !== id) {
    const clash = ctx.cultivations.find((c) => c.id.toLowerCase() === id.toLowerCase())
    if (clash) errors.id = `${clash.id} already exists${clash.archived ? ' (archived)' : ''}. Change the id, for example add -2 at the end.`
  }

  if (!isIsoDate(form.plantingDate)) errors.plantingDate = 'Enter the planting date.'
  const hasEnd = form.plannedEndDate.trim() !== ''
  if (hasEnd && !isIsoDate(form.plannedEndDate)) errors.plannedEndDate = 'Enter a valid planned end date, or leave it empty.'
  else if (hasEnd && !errors.plantingDate && form.plannedEndDate < form.plantingDate) errors.plannedEndDate = 'The planned end date must be on or after the planting date.'

  const area = toNumber(form.areaM2)
  if (!Number.isFinite(area) || area <= 0) errors.areaM2 = 'Enter the growing area in m², above 0.'
  else if (greenhouse && ctx.live !== false) {
    const { used, free } = areaLeft(greenhouse, ctx.cultivations, ctx.editingId)
    if (area > free + AREA_SLACK) {
      errors.areaM2 = `Too big for ${greenhouse.facilityName} ${greenhouse.name}: its area is ${fixed(greenhouse.areaM2, 0)} m² and the other cultivations use ${fixed(used, 0)} m², leaving ${fixed(Math.max(free, 0), 0)} m². Make this smaller or raise the greenhouse area.`
    }
  }
  return errors
}

export interface GreenhouseForm {
  facilityId: string
  code: string
  name: string
  areaM2: string
  ledWattsPerM2: string
}

export function validateGreenhouse(
  form: GreenhouseForm,
  ctx: { catalog: Catalog; cultivations: Cultivation[]; editingId: string | null },
): Errors {
  const errors: Errors = {}
  const facility = ctx.catalog.facilities.find((f) => f.id === form.facilityId)
  if (!facility) errors.facilityId = 'Choose a facility.'
  const name = form.name.trim()
  if (!name) errors.name = 'Enter a name.'
  const code = form.code.trim()
  if (!code) errors.code = 'Enter a code.'
  else if (!isValidId(code)) errors.code = 'Use letters, digits and dashes only, for example P1.'
  if (facility && name && code) {
    const id = `${facility.id}-${code}`
    const others = ctx.catalog.greenhouses.filter((g) => g.id !== ctx.editingId)
    if (others.some((g) => g.id.toLowerCase() === id.toLowerCase())) errors.code = `${id} is already used. Change the code.`
    else if (others.some((g) => g.facilityId === facility.id && g.name.toLowerCase() === name.toLowerCase())) errors.name = `${facility.name} already has a greenhouse called ${name}.`
  }
  const area = toNumber(form.areaM2)
  if (!Number.isFinite(area) || area <= 0) errors.areaM2 = 'Enter the growing area in m², above 0.'
  else if (ctx.editingId) {
    const existing = ctx.catalog.greenhouses.find((g) => g.id === ctx.editingId)
    const used = existing ? areaLeft(existing, ctx.cultivations).used : 0
    if (area < used - AREA_SLACK) errors.areaM2 = `The cultivations in this greenhouse use ${fixed(used, 0)} m², so its area cannot be smaller than that.`
  }
  if (form.ledWattsPerM2.trim() !== '') {
    const led = toNumber(form.ledWattsPerM2)
    if (!Number.isFinite(led) || led < 0) errors.ledWattsPerM2 = 'Enter the installed LED power in W/m², or leave it empty.'
  }
  return errors
}

export interface FacilityForm {
  code: string
  name: string
  region: string
  currency: string
}

export function validateFacility(form: FacilityForm, ctx: { catalog: Catalog; editingId: string | null }): Errors {
  const errors: Errors = {}
  const name = form.name.trim()
  const code = form.code.trim()
  const others = ctx.catalog.facilities.filter((f) => f.id !== ctx.editingId)
  if (!name) errors.name = 'Enter a name.'
  else if (others.some((f) => f.name.toLowerCase() === name.toLowerCase())) errors.name = `There is already a facility called ${name}.`
  if (!code) errors.code = 'Enter a code.'
  else if (!isValidId(code) || code.includes('-')) errors.code = 'Use letters and digits only, for example ON.'
  else if (others.some((f) => f.id.toLowerCase() === code.toLowerCase())) errors.code = `The code ${code.toUpperCase()} is already used. Change it.`
  if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) errors.currency = 'Enter a three-letter currency code, for example USD.'
  return errors
}
