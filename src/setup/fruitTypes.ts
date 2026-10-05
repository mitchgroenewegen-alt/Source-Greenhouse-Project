// Fruit types and their specs: the weight (and optional diameter) range a fruit type should have, and what the
// workbook measured. The numbers below are placeholders until Mitch enters the real ones.

import type { Cultivation } from '../data/types'
import type { FruitType } from '../workspace/types'
import type { Errors } from './validate'

const placeholder = (id: string, name: string, weightMinG: number, weightMaxG: number): FruitType => ({
  id,
  name,
  weightMinG,
  weightMaxG,
  diameterMinMm: null,
  diameterMaxMm: null,
  pricePerKg: null,
  placeholder: true,
})

/**
 * Shown when the workspace holds no fruit types. They become workspace rows (all of them, at once) with the first
 * change made on the Fruit types screen, so a signed-out or read-only viewer still sees specs.
 */
export const DEFAULT_FRUIT_TYPES: FruitType[] = [
  placeholder('grape', 'Grape', 8, 15),
  placeholder('snack', 'Snack', 10, 20),
  placeholder('cherry', 'Cherry', 15, 25),
  placeholder('grape-on-the-vine', 'Grape on the vine', 10, 20),
  placeholder('cocktail', 'Cocktail', 30, 50),
  placeholder('plum', 'Plum', 40, 70),
  placeholder('roma', 'Roma', 60, 100),
  placeholder('tov', 'TOV', 80, 170),
  placeholder('beef', 'Beef', 200, 350),
]

/** The fruit type of each workbook variety, used until a cultivation is given one of its own. */
export const WORKBOOK_VARIETY_TYPE: Record<string, string> = { tov: 'tov', cherry: 'cherry', cocktail: 'cocktail', snack: 'snack' }

/** The fruit types in use: the workspace's, or the defaults while the workspace has none. `seeded` is false for the defaults. */
export function effectiveFruitTypes(stored: FruitType[]): { types: FruitType[]; seeded: boolean } {
  return stored.length > 0 ? { types: stored, seeded: true } : { types: DEFAULT_FRUIT_TYPES, seeded: false }
}

/** The id of a cultivation's fruit type: the one chosen in the app, else the workbook default for its variety, else none. */
export function fruitTypeIdOf(c: Pick<Cultivation, 'variety' | 'fruitType'>): string | null {
  return c.fruitType ?? WORKBOOK_VARIETY_TYPE[c.variety.toLowerCase()] ?? null
}

export const cultivationsUsing = <C extends Pick<Cultivation, 'variety' | 'fruitType'>>(typeId: string, cultivations: C[]): C[] =>
  cultivations.filter((c) => fruitTypeIdOf(c) === typeId)

/** Why a fruit type cannot be removed (naming the cultivations that use it), or null when it can. */
export function removalBlock(type: Pick<FruitType, 'id' | 'name'>, cultivations: Pick<Cultivation, 'id' | 'variety' | 'fruitType'>[]): string | null {
  const using = cultivationsUsing(type.id, cultivations)
  if (using.length === 0) return null
  return `${type.name} is used by ${using.map((c) => c.id).join(', ')}. Give ${using.length === 1 ? 'that cultivation' : 'those cultivations'} another fruit type first.`
}

/** An id for a new fruit type, from its name ("Grape on the vine" gives grape-on-the-vine), made unique with -2, -3, ... */
export function fruitTypeId(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'type'
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

export type SpecState = 'under' | 'within' | 'over'

/** Is an average fruit weight under, within or over the type's weight range? The ends of the range count as within. */
export function specCheck(weightG: number, type: Pick<FruitType, 'weightMinG' | 'weightMaxG'>): SpecState {
  if (weightG < type.weightMinG) return 'under'
  if (weightG > type.weightMaxG) return 'over'
  return 'within'
}

const trim = (n: number) => String(Number(n.toFixed(1)))

/** "30–50 g" */
export const weightRangeText = (type: Pick<FruitType, 'weightMinG' | 'weightMaxG'>) => `${trim(type.weightMinG)}–${trim(type.weightMaxG)} g`

/** "20–30 mm", or null when no diameter range is entered. */
export function diameterRangeText(type: Pick<FruitType, 'diameterMinMm' | 'diameterMaxMm'>): string | null {
  return type.diameterMinMm === null || type.diameterMaxMm === null ? null : `${trim(type.diameterMinMm)}–${trim(type.diameterMaxMm)} mm`
}

/** The average of the weekly average fruit weights of some cultivations (weeks without a value are skipped); null when there are none. */
export function measuredFruitWeight(
  cultivationIds: string[],
  weeks: string[],
  actualOf: (cultivation: string, week: string) => number | null | undefined,
): number | null {
  const values: number[] = []
  for (const id of cultivationIds) for (const week of weeks) {
    const v = actualOf(id, week)
    if (v !== null && v !== undefined) values.push(v)
  }
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
}

export interface FruitTypeInput {
  name: string
  weightMinG: string
  weightMaxG: string
  diameterMinMm: string
  diameterMaxMm: string
  pricePerKg: string
}

const num = (text: string) => (text.trim() === '' ? null : Number(text))

/** Checks the text typed into the fruit type form. `others` are the other fruit types, for the unique name. */
export function validateFruitType(input: FruitTypeInput, others: Pick<FruitType, 'name'>[]): Errors {
  const errors: Errors = {}
  const name = input.name.trim()
  if (!name) errors.name = 'Enter a name.'
  else if (others.some((o) => o.name.trim().toLowerCase() === name.toLowerCase())) errors.name = `There is already a fruit type called ${name}.`
  const min = num(input.weightMinG)
  const max = num(input.weightMaxG)
  if (min === null || !Number.isFinite(min) || min <= 0) errors.weightMinG = 'Enter the lowest weight in grams, above 0.'
  if (max === null || !Number.isFinite(max) || max <= 0) errors.weightMaxG = 'Enter the highest weight in grams, above 0.'
  if (!errors.weightMinG && !errors.weightMaxG && min! > max!) errors.weightMaxG = 'The highest weight must not be below the lowest.'
  const dMin = num(input.diameterMinMm)
  const dMax = num(input.diameterMaxMm)
  if ((dMin === null) !== (dMax === null)) errors[dMin === null ? 'diameterMinMm' : 'diameterMaxMm'] = 'Enter both diameters, or leave both empty.'
  else if (dMin !== null && dMax !== null) {
    if (!Number.isFinite(dMin) || dMin <= 0) errors.diameterMinMm = 'Enter a diameter in mm, above 0.'
    else if (!Number.isFinite(dMax) || dMax <= 0) errors.diameterMaxMm = 'Enter a diameter in mm, above 0.'
    else if (dMin > dMax) errors.diameterMaxMm = 'The largest diameter must not be below the smallest.'
  }
  const price = num(input.pricePerKg)
  if (price !== null && (!Number.isFinite(price) || price < 0)) errors.pricePerKg = 'Enter a price of 0 or more, or leave it empty.'
  return errors
}

/**
 * What to save for a change to one fruit type. While the workspace has none yet, the defaults are saved along with it,
 * so from then on the list is the workspace's own and the other eight are not lost.
 */
export function itemsToSave(stored: FruitType[], changed: FruitType): FruitType[] {
  return stored.length > 0 ? [changed] : [...DEFAULT_FRUIT_TYPES.filter((d) => d.id !== changed.id), changed]
}

/** What the fruit type form starts from: the numbers as text, or empty for a new type. */
export function fruitTypeFormOf(type?: FruitType): FruitTypeInput {
  const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))
  return { name: type?.name ?? '', weightMinG: text(type?.weightMinG), weightMaxG: text(type?.weightMaxG), diameterMinMm: text(type?.diameterMinMm), diameterMaxMm: text(type?.diameterMaxMm), pricePerKg: text(type?.pricePerKg) }
}

/** The fruit type the form describes (call it only when validateFruitType found nothing wrong). */
export function fruitTypeFromForm(id: string, input: FruitTypeInput, placeholder: boolean, previous?: FruitType): FruitType {
  const num = (text: string) => (text.trim() === '' ? null : Number(text))
  return {
    id,
    name: input.name.trim(),
    weightMinG: Number(input.weightMinG),
    weightMaxG: Number(input.weightMaxG),
    diameterMinMm: num(input.diameterMinMm),
    diameterMaxMm: num(input.diameterMaxMm),
    pricePerKg: num(input.pricePerKg),
    // The note about an imported price stays only while the price is the imported one.
    ...(previous?.priceSource && previous.pricePerKg === num(input.pricePerKg) ? { priceSource: previous.priceSource } : {}),
    placeholder,
  }
}
