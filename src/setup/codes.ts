// The short codes that cultivation ids are built from: <facility code>-<greenhouse code>-<Variety>, e.g. ON-P2-TOV.
// The workbook's own ids use PA, AZ and ON for the facilities and P1 to P3 for "Phase 1" to "Phase 3".

const words = (text: string) => text.split(/[^A-Za-z0-9]+/).filter(Boolean)

/**
 * A facility code from its name: the first two letters, or the initials of the first two words ("New Mexico" gives NM).
 * The workbook's PA for Pennsylvania is the state's abbreviation, which cannot be worked out from the name, so a code
 * suggested here can differ from it; the form lets the person change the code.
 */
export function facilityCode(name: string): string {
  const parts = words(name)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

/** A greenhouse code from its name: the initial of each word and the digits ("Phase 1" gives P1, "Tunnel North" gives TN). */
export function greenhouseCode(name: string): string {
  const parts = words(name)
  if (parts.length === 0) return ''
  if (parts.length === 1) return /^\d+$/.test(parts[0]!) ? parts[0]! : parts[0]!.slice(0, 2).toUpperCase()
  return parts.map((p) => (/^\d+$/.test(p) ? p : p[0]!.toUpperCase())).join('')
}

/** The variety as it appears at the end of an id: no spaces or symbols, each word starting with a capital ("Grape on the vine" gives GrapeOnTheVine, "TOV" stays TOV). */
export function varietyPart(variety: string): string {
  return words(variety)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join('')
}

/** The id a new cultivation gets in a greenhouse (whose id is <facility code>-<greenhouse code>). Empty until there is a variety. */
export function cultivationIdFor(greenhouseId: string, variety: string): string {
  const part = varietyPart(variety)
  return greenhouseId && part ? `${greenhouseId}-${part}` : ''
}

/** `wanted` if nobody uses it, otherwise the first of wanted-2, wanted-3, ... that is free. Ids are compared ignoring case. */
export function freeId(wanted: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((t) => t.toLowerCase()))
  if (!wanted || !used.has(wanted.toLowerCase())) return wanted
  for (let n = 2; ; n++) if (!used.has(`${wanted}-${n}`.toLowerCase())) return `${wanted}-${n}`
}

/** Letters, digits and dashes only, so an id is safe in a link and in the "|"-joined keys used elsewhere. */
export const isValidId = (id: string) => /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(id)
