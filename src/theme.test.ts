import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Reads the colour tokens straight from src/index.css and checks the contrast of the pairs that are used together,
// so a token can be tuned there without quietly breaking WCAG AA. 4.5:1 for text, 3:1 for marks and control edges.

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const token = (name: string): string => {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`No --color-${name} token in src/index.css`)
  return match[1]!
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
const over = (name: string, onto: string, min: number) => expect(contrast(token(name), token(onto)), `${name} on ${onto}`).toBeGreaterThanOrEqual(min)

const SURFACES = ['page', 'card', 'tile', 'field']

describe('surfaces', () => {
  it('step from the page to the palest green, and none is white', () => {
    const lums = SURFACES.map((s) => luminance(token(s)))
    expect(lums).toEqual([...lums].sort((a, b) => a - b)) // page < card < tile < field
    for (const s of SURFACES) expect(token(s).toLowerCase(), s).not.toBe('#ffffff')
  })

  it('are green: the green channel leads and the colour is greyed, not vivid', () => {
    for (const s of SURFACES) {
      const hex = token(s)
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
      expect(g, s).toBeGreaterThan(r)
      expect(g, s).toBeGreaterThanOrEqual(b)
      expect(Math.max(r, g, b) - Math.min(r, g, b), `${s} saturation`).toBeLessThan(40)
    }
  })

  it('keeps each step visibly apart, with a line that is darker than the surface it edges', () => {
    expect(contrast(token('card'), token('page'))).toBeGreaterThan(1.15)
    expect(contrast(token('tile'), token('card'))).toBeGreaterThan(1.05)
    expect(contrast(token('line'), token('page'))).toBeGreaterThan(1.2)
    expect(contrast(token('line-soft'), token('card'))).toBeGreaterThan(1.1)
  })
})

describe('text contrast (4.5:1)', () => {
  it('ink, ink-2 and ink-3 read on every surface, ink-3 included on the page', () => {
    for (const ink of ['ink', 'ink-2', 'ink-3']) for (const s of SURFACES) over(ink, s, 4.5)
  })
  it('brand and flag text read on the surfaces they sit on', () => {
    for (const s of SURFACES) over('brand', s, 4.5)
    for (const s of ['card', 'tile']) over('flag-ink', s, 4.5)
  })
  it('white text reads on the brand green, and brand text on the brand-soft fill', () => {
    expect(contrast('#ffffff', token('brand'))).toBeGreaterThanOrEqual(4.5)
    over('brand', 'brand-soft', 4.5)
    over('ink', 'brand-soft', 4.5)
  })
  it('badge text reads on its badge background, and body text on the tinted backgrounds', () => {
    for (const k of ['ok', 'warn', 'bad', 'none']) over(`${k}-ink`, `${k}-bg`, 4.5)
    for (const k of ['ok', 'warn', 'bad']) {
      over('ink', `${k}-bg`, 4.5)
      over('ink-3', `${k}-bg`, 4.5)
    }
  })
})

describe('marks and edges (3:1)', () => {
  it('status marks (chart bands, meter fill, dots) show on cards and tiles', () => {
    for (const k of ['ok', 'warn', 'bad']) for (const s of ['card', 'tile']) over(k, s, 3)
    for (const c of ['actual', 'target', 'flag', 'budget']) for (const s of ['card', 'tile']) over(c, s, 3)
  })
  it('badge edges stand out from the card or tile, so a badge never melts into the green', () => {
    for (const k of ['ok', 'warn', 'bad', 'none']) for (const s of ['card', 'tile']) over(`${k}-line`, s, 3)
  })
  it('the ok badge is a stronger green than the card it sits on', () => {
    expect(contrast(token('ok-bg'), token('card'))).toBeGreaterThan(1.1)
  })
  it('input and select edges show on every surface', () => {
    for (const s of SURFACES) over('line-strong', s, 3)
  })
})
