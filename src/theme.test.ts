import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BANDS } from './components/detail/chartBands'

// Reads the colour tokens straight from src/index.css and checks the contrast of the pairs that are used together,
// so a token can be tuned there without quietly breaking WCAG AA. 4.5:1 for text, 3:1 for marks and control edges.
//
// The look: a mid-green page, paler green cards on it, paler tiles inside the cards, and the palest green (field) for
// controls. Nothing is white. The page, card and tile greens are the ones the product owner picked on a screenshot.

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const token = (name: string): string => {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`No --color-${name} token in src/index.css`)
  return match[1]!.toLowerCase()
}

type Rgb = [number, number, number]
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb

function luminance(color: string | Rgb): number {
  const [r, g, b] = (typeof color === 'string' ? rgb(color) : color).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
function contrast(a: string | Rgb, b: string | Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
/** `top` painted over `bottom` at `alpha` (Tailwind's `bg-ok-bg/60`, `text-white/80`). */
const mix = (top: string, bottom: string, alpha: number): Rgb => rgb(top).map((v, i) => v * alpha + rgb(bottom)[i]! * (1 - alpha)) as Rgb

/** CIE76 colour difference in CIELAB (D65): how far apart two colours look, whatever their lightness. */
function deltaE(a: string | Rgb, b: string | Rgb): number {
  const lab = (color: string | Rgb) => {
    const [r, g, b2] = (typeof color === 'string' ? rgb(color) : color).map((v) => v / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as Rgb
    const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
    const [x, y, z] = [(0.4124 * r + 0.3576 * g + 0.1805 * b2) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b2, (0.0193 * r + 0.1192 * g + 0.9505 * b2) / 1.08883].map(f) as Rgb
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
  }
  const [p, q] = [lab(a), lab(b)]
  return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!)
}

/** A colour given as a CSS variable in the components, `var(--color-ok)`, resolved to the token's hex. */
const cssVar = (value: string): string => {
  const match = value.match(/^var\(--color-([a-z0-9-]+)\)$/)
  if (!match) throw new Error(`${value} is not a colour token`)
  return token(match[1]!)
}

/** Hue (degrees) and HSL saturation (0 to 1) of a colour. */
function hueAndSaturation(hex: string): { hue: number; saturation: number } {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as Rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const lightness = (max + min) / 2
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1))
  const hue = max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4
  return { hue: (hue * 60 + 360) % 360, saturation }
}

const over = (name: string, onto: string, min: number) => expect(contrast(token(name), token(onto)), `${name} on ${onto}`).toBeGreaterThanOrEqual(min)

const SURFACES = ['page', 'card', 'tile', 'field']
/** Where text sits inside a card: on the card, on a tile, in a field (the page is a separate case, see below). */
const INSET = ['card', 'tile', 'field']
const STATUS = ['ok', 'warn', 'bad']
const WHITE = '#ffffff'

describe('surfaces', () => {
  it('page, card and tile are the greens the product owner picked', () => {
    expect(token('page')).toBe('#7ab17d')
    expect(token('card')).toBe('#b0d0b3')
    expect(token('tile')).toBe('#c9decb')
  })

  it('step from the page to the palest green: page < card < tile < field', () => {
    const lums = SURFACES.map((s) => luminance(token(s)))
    expect(lums).toEqual([...lums].sort((a, b) => a - b))
    expect(new Set(lums).size).toBe(SURFACES.length)
  })

  it('keeps each step visibly apart from the one below it', () => {
    expect(contrast(token('card'), token('page'))).toBeGreaterThan(1.4)
    expect(contrast(token('tile'), token('card'))).toBeGreaterThan(1.15)
    expect(contrast(token('field'), token('tile'))).toBeGreaterThan(1.1)
  })

  it('none is white or near-white, and the palest step is still plainly green', () => {
    for (const s of SURFACES) {
      const [r, g, b] = rgb(token(s))
      expect(token(s), s).not.toBe(WHITE)
      expect(contrast(token(s), WHITE), `${s} against white`).toBeGreaterThanOrEqual(1.2)
      expect(g - Math.max(r, b), `${s}: green channel leads`).toBeGreaterThanOrEqual(12)
    }
  })

  it('are one green, not grey and not neon: the same hue family, clearly tinted, never vivid', () => {
    const hues = SURFACES.map((s) => hueAndSaturation(token(s)))
    for (const [i, { hue, saturation }] of hues.entries()) {
      expect(hue, `${SURFACES[i]} hue`).toBeGreaterThanOrEqual(110)
      expect(hue, `${SURFACES[i]} hue`).toBeLessThanOrEqual(140)
      expect(saturation, `${SURFACES[i]} saturation`).toBeGreaterThanOrEqual(0.2)
      expect(saturation, `${SURFACES[i]} saturation`).toBeLessThanOrEqual(0.45)
    }
    expect(Math.max(...hues.map((h) => h.hue)) - Math.min(...hues.map((h) => h.hue)), 'hue spread').toBeLessThanOrEqual(15)
  })

  it('no background token is white or near-white (surfaces, brand-soft and the status tints)', () => {
    for (const bg of [...SURFACES, 'brand-soft', 'ok-bg', 'warn-bg', 'bad-bg', 'none-bg', 'flag-bg']) {
      expect(contrast(token(bg), WHITE), `${bg} against white`).toBeGreaterThanOrEqual(1.2)
    }
  })

  it('brand-soft stands apart from the card and the tile it sits on', () => {
    expect(contrast(token('brand-soft'), token('card'))).toBeGreaterThan(1.25)
    expect(contrast(token('brand-soft'), token('tile'))).toBeGreaterThan(1.08)
  })
})

describe('lines', () => {
  it('line (a card on the page, the header and bottom bar) is darker than the page and shows on the card and tile', () => {
    expect(luminance(token('line'))).toBeLessThan(luminance(token('page')))
    expect(contrast(token('line'), token('page'))).toBeGreaterThan(1.2)
    expect(contrast(token('line'), token('card'))).toBeGreaterThan(1.5)
    expect(contrast(token('line'), token('tile'))).toBeGreaterThan(1.5) // chart axis, filter pill edge
  })
  it('line-soft (dividers, tile edges, chart grid lines) is darker than the card and shows on the card and the tile', () => {
    expect(luminance(token('line-soft'))).toBeLessThan(luminance(token('card')))
    expect(contrast(token('line-soft'), token('card'))).toBeGreaterThan(1.25)
    expect(contrast(token('line-soft'), token('tile'))).toBeGreaterThan(1.4)
  })
  it('the unfilled part of the Waste meter shows on the tile', () => {
    // 1.2 is the most the track can take: it must also stay 3:1 from the status fills, and ok is only about 3.7 on the tile.
    expect(contrast(token('track'), token('tile'))).toBeGreaterThan(1.2)
    expect(deltaE(token('track'), token('tile')), 'track against tile').toBeGreaterThan(5)
    expect(contrast(token('track'), token('line-soft'))).toBeLessThan(1.4) // a quiet backdrop, not a second line
  })
  it('the Waste meter fill keeps 3:1 against the unfilled track, so the reading (where the fill stops) shows', () => {
    for (const k of STATUS) over(k, 'track', 3)
    over('ink-3', 'track', 3) // the neutral fill of a tile with no status
    over('ink', 'track', 4.5) // the budget tick and the stop bar
  })
  it('input and select edges show on every surface (3:1)', () => {
    for (const s of SURFACES) over('line-strong', s, 3)
  })
})

describe('text contrast (4.5:1)', () => {
  it('ink reads on every surface, the page included', () => {
    for (const s of SURFACES) over('ink', s, 4.5)
  })
  it('ink-2 and ink-3 read on the card, the tile and the field. Text straight on the page is ink: ink-2 and ink-3 are too pale for the mid-green page', () => {
    for (const ink of ['ink-2', 'ink-3']) for (const s of INSET) over(ink, s, 4.5)
  })
  it('ink-2 and ink-3 read on the hover and active fills', () => {
    for (const ink of ['ink-2', 'ink-3']) for (const s of ['tile', 'brand-soft']) over(ink, s, 4.5)
  })
  it('brand and flag text read on the surfaces inside a card', () => {
    for (const s of [...INSET, 'brand-soft']) over('brand', s, 4.5)
    for (const s of ['card', 'tile']) over('flag-ink', s, 4.5)
    over('flag', 'tile', 4.5) // the flagged-value triangle in the week-by-week table is a text glyph
  })
  it('white text reads on the brand green and on the red count badge, in full and at the reduced opacities used on tabs', () => {
    expect(contrast(WHITE, token('brand'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(WHITE, token('bad'))).toBeGreaterThanOrEqual(4.5)
    for (const alpha of [0.8, 0.85, 0.9]) expect(contrast(mix(WHITE, token('brand'), alpha), token('brand')), `white/${alpha * 100} on brand`).toBeGreaterThanOrEqual(4.5)
  })
  it('ink and brand text read on the brand-soft fill', () => {
    over('brand', 'brand-soft', 4.5)
    over('ink', 'brand-soft', 4.5)
  })
  it('badge text reads on its badge background, and body text on the tinted backgrounds', () => {
    for (const k of [...STATUS, 'none']) over(`${k}-ink`, `${k}-bg`, 4.5)
    for (const k of STATUS) {
      over('ink', `${k}-bg`, 4.5)
      over('ink-3', `${k}-bg`, 4.5)
    }
  })
  it('the week-by-week table cells (a status tint over the tile) keep their figures readable and stand out from the tile', () => {
    // The opacities of CELL in src/components/detail/WeeklyTable.tsx: green in full, amber and red at 70%.
    const cells = { ok: mix(token('ok-bg'), token('tile'), 1), warn: mix(token('warn-bg'), token('tile'), 0.7), bad: mix(token('bad-bg'), token('tile'), 0.7) }
    for (const [k, cell] of Object.entries(cells)) {
      expect(contrast(token('ink'), cell), `ink on ${k} cell`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token('ink-3'), cell), `ink-3 on ${k} cell`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token(k), cell), `${k} status mark on its cell`).toBeGreaterThanOrEqual(3)
      expect(contrast(token('flag'), cell), `flag triangle on ${k} cell`).toBeGreaterThanOrEqual(4.5)
      expect(deltaE(cell, token('tile')), `${k} cell against the tile`).toBeGreaterThan(5)
    }
    const weekly = readFileSync(new URL('./components/detail/WeeklyTable.tsx', import.meta.url), 'utf8')
    expect(weekly).toMatch(/green: 'bg-ok-bg'/)
    expect(weekly).toMatch(/amber: 'bg-warn-bg\/70'/)
    expect(weekly).toMatch(/red: 'bg-bad-bg\/70'/)
  })
  it('the second crop of the Climate overlay keeps 3:1 on the card and the tile', () => {
    for (const s of ['card', 'tile']) over('other', s, 3)
  })
  it('the data-check rule chip: flag-ink on the lavender flag-bg, a chip that stands apart from the card', () => {
    over('flag-ink', 'flag-bg', 4.5)
    expect(contrast(token('flag-bg'), token('card'))).toBeGreaterThan(1.15)
  })
})

describe('marks and edges (3:1)', () => {
  it('status marks (chart bands, meter fill, dots) show on cards and tiles', () => {
    for (const k of STATUS) for (const s of ['card', 'tile']) over(k, s, 3)
    for (const c of ['actual', 'target', 'flag', 'budget']) for (const s of ['card', 'tile']) over(c, s, 3)
  })
  it('the keyboard focus ring shows on every surface, the page green included', () => {
    for (const s of SURFACES) over('focus', s, 3)
  })
  it('a focused tab next to the selected (brand) tab: the ring is lifted over it with a field halo, and both stand out from the brand fill', () => {
    const rule = css.match(/\[role='tab'\]:focus-visible\s*\{([^}]*)\}/)
    expect(rule, 'tab focus rule in src/index.css').not.toBeNull()
    expect(rule![1]).toMatch(/z-index:\s*1/)
    expect(rule![1]).toMatch(/box-shadow:\s*0 0 0 2px var\(--color-field\)/)
    over('focus', 'field', 3)
    over('field', 'brand', 3)
  })
  it('scroll bars: a clear track over the green and a line-strong thumb, never the browser\'s near-white track', () => {
    const html = css.match(/\nhtml\s*\{([^}]*)\}/)![1]!
    const match = html.match(/scrollbar-color:\s*(var\(--color-[a-z0-9-]+\))\s+transparent/)
    expect(match, 'scrollbar-color on html').not.toBeNull()
    for (const s of ['page', 'card', 'tile']) expect(contrast(cssVar(match![1]!), token(s)), `scroll bar thumb on ${s}`).toBeGreaterThanOrEqual(3)
  })
  it('chart bands (over the tile): the lines and flags keep 3:1 on them, and On track and Watch differ in lightness, not only hue', () => {
    const tile = token('tile')
    const band = (b: { fill: string; opacity: number }) => mix(cssVar(b.fill), tile, b.opacity)
    const onTrack = band(BANDS.onTrack)
    const watch = band(BANDS.watch)
    for (const [name, b] of [['On track', onTrack], ['Watch', watch]] as const) {
      for (const mark of ['actual', 'target', 'flag']) expect(contrast(token(mark), b), `${mark} on the ${name} band`).toBeGreaterThanOrEqual(3)
      expect(contrast(b, WHITE), `${name} band against white`).toBeGreaterThanOrEqual(1.2)
      expect(deltaE(b, tile), `${name} band against the tile`).toBeGreaterThan(5)
    }
    expect(luminance(onTrack), 'On track band is darker than the tile').toBeLessThan(luminance(tile))
    expect(luminance(watch), 'Watch band is lighter than the tile').toBeGreaterThan(luminance(tile))
    expect(contrast(onTrack, watch), 'On track band against Watch band').toBeGreaterThanOrEqual(1.25)
    const { hue } = hueAndSaturation(`#${watch.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`)
    expect(hue, 'the Watch band stays amber').toBeLessThan(55)
  })
  it('badge edges stand out from the card or tile, so a badge never melts into the green', () => {
    for (const k of [...STATUS, 'none']) for (const s of ['card', 'tile']) over(`${k}-line`, s, 3)
  })
  it('darkening for contrast keeps the hues: actual stays blue, warn stays amber, budget stays a neutral grey-green', () => {
    expect(hueAndSaturation(token('actual')).hue, 'actual stays blue').toBeGreaterThan(200)
    expect(hueAndSaturation(token('actual')).hue, 'actual stays blue').toBeLessThan(230)
    expect(hueAndSaturation(token('warn')).hue, 'warn stays amber').toBeGreaterThan(25)
    expect(hueAndSaturation(token('warn')).hue, 'warn stays amber').toBeLessThan(45)
    expect(hueAndSaturation(token('budget')).saturation, 'budget stays neutral').toBeLessThan(0.2)
    expect(hueAndSaturation(token('actual')).saturation, 'actual is a colour, budget is not').toBeGreaterThan(0.4)
  })
})

describe('the header and the chart pop-ups', () => {
  const shell = readFileSync(new URL('./components/layout/AppShell.tsx', import.meta.url), 'utf8')
  const facility = readFileSync(new URL('./components/facilities/FacilityCard.tsx', import.meta.url), 'utf8')

  it('the sticky header is opaque, so a brand-filled tab scrolling under it never darkens the brand logo text below 4.5:1', () => {
    const header = shell.match(/<header id="app-header" className="([^"]*)"/)
    expect(header, 'app header').not.toBeNull()
    expect(header![1]).toMatch(/\bbg-card\b/)
    expect(header![1]).not.toMatch(/bg-[a-z-]+\/\d+|backdrop-/)
    over('brand', 'card', 4.5)
  })
  it('the Facilities bar tooltip writes its rows in ink on the field green (Recharts would use the pale series colours)', () => {
    expect(facility).toMatch(/itemStyle=\{\{ color: 'var\(--color-ink\)' \}\}/)
    expect(facility).toMatch(/contentStyle=\{\{ background: 'var\(--color-field\)'/)
    over('ink', 'field', 4.5)
  })
  it('the Facilities hover column keeps the value labels (ink-3, ink) at 4.5:1 and the bars at 3:1', () => {
    const cursor = facility.match(/cursor=\{\{ fill: '(var\(--color-[a-z0-9-]+\))' \}\}/)
    expect(cursor, 'cursor fill (solid, a token)').not.toBeNull()
    const fill = cssVar(cursor![1]!)
    for (const ink of ['ink', 'ink-3']) expect(contrast(token(ink), fill), `${ink} on the hover column`).toBeGreaterThanOrEqual(4.5)
    for (const bar of ['actual', 'budget']) expect(contrast(token(bar), fill), `${bar} bar on the hover column`).toBeGreaterThanOrEqual(3)
    expect(deltaE(fill, token('tile')), 'the hover column shows on the tile').toBeGreaterThan(5)
  })
})

describe('no hard-coded colours outside the tokens', () => {
  const sources = (readdirSync(new URL('.', import.meta.url), { recursive: true }) as string[])
    .filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    .map((f) => ({ file: f, text: readFileSync(new URL(f, import.meta.url), 'utf8') }))

  it('finds the source files', () => {
    expect(sources.length).toBeGreaterThan(20)
  })
  it('has no white or Tailwind palette backgrounds, borders or fills in the components', () => {
    const forbidden = [
      /\b(?:bg|border|from|to|via|fill|stroke|ring|divide|outline)-(?:white|black)\b/,
      /\b(?:bg|border|from|to|via|fill|stroke|ring|divide|text|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
      /\bbg-\[/,
      /rgba?\(\s*\d/,
      /hsla?\(\s*\d/,
    ]
    for (const { file, text } of sources.filter((s) => s.file.endsWith('.tsx') || (s.file.endsWith('.ts') && s.file !== 'theme.test.ts'))) {
      for (const pattern of forbidden) expect(text, `${file} matches ${pattern}`).not.toMatch(pattern)
    }
  })
  it('has no hex colour in the components or in the CSS outside the @theme block', () => {
    const outsideTheme = css.replace(/@theme\s*\{[\s\S]*?\n\}/, '')
    expect(outsideTheme).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    for (const { file, text } of sources.filter((s) => s.file.endsWith('.tsx') || (s.file.endsWith('.ts') && s.file !== 'theme.test.ts'))) {
      expect(text, `${file} has a hex colour`).not.toMatch(/['"`]#[0-9a-fA-F]{3,8}['"`]/)
    }
  })
})
