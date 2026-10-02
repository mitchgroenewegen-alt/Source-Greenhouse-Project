/** A number with at most `significant` significant digits and no trailing zeros: 0.4, 20.6, 1350. */
export function plain(value: number, significant = 4): string {
  if (!Number.isFinite(value)) return value > 0 ? '+inf' : '-inf'
  return String(Number(value.toPrecision(significant)))
}

/** Fixed decimals with a thin grouping for thousands, e.g. 98 400. */
export function fixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '+inf' : '-inf'
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** "+3.2%" / "-6.9%" */
export function signedPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return value > 0 ? 'above a zero target' : 'below a zero target'
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(decimals)}%`
}

/** "+1.2" / "-0.4" */
export function signedNumber(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(decimals)}`
}

/** A value with its unit, e.g. "20.6 °C", "36 %", "135 fruits/m²". */
export function withUnit(value: number, unit: string, significant = 4): string {
  const text = plain(value, significant)
  return unit === '%' ? `${text} %` : `${text} ${unit}`
}

/** "3 Sep 2025, 10:00" in the viewer's own time zone. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
