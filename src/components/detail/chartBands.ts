/**
 * The shading behind a KPI line chart: the On track band and the Watch (amber) bands. The chart and its legend both
 * draw from here, over the tile, so the key always matches the plot. src/theme.test.ts mixes these over the tile and
 * checks that the actual, target and flag marks keep 3:1 on each band and that the two bands differ in lightness as
 * well as hue (one darker than the tile, one lighter), so they stay apart for colour-blind readers too.
 */
export interface Band {
  /** A colour token, as a CSS variable. */
  fill: string
  /** How much of it is laid over the tile. */
  opacity: number
  /** The legend swatch's edge. */
  edge: string
}

export const BANDS = {
  onTrack: { fill: 'var(--color-ok)', opacity: 0.16, edge: 'var(--color-ok-line)' },
  // The amber tint, as on the Watch badges and the Watch cells of the week-by-week table (warn-bg at 70% over the tile).
  watch: { fill: 'var(--color-warn-bg)', opacity: 0.7, edge: 'var(--color-warn-line)' },
} as const satisfies Record<string, Band>
