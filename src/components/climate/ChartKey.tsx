/** One entry of a chart key: a line (solid, dashed or with a mark), a bar, or a shaded area. */
export interface KeyItem {
  label: string
  kind: 'line' | 'dashed' | 'bar' | 'diamond' | 'dot'
  color: string
}

function Swatch({ kind, color }: Pick<KeyItem, 'kind' | 'color'>) {
  switch (kind) {
    case 'bar':
      return (
        <svg width="14" height="12" aria-hidden="true">
          <rect x="1" y="1" width="12" height="10" rx="2" fill={color} />
        </svg>
      )
    case 'dashed':
      return (
        <svg width="22" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="22" y2="4" stroke={color} strokeWidth="2.5" strokeDasharray="5 3" />
        </svg>
      )
    case 'diamond':
      return (
        <svg width="22" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2.5" />
          <path d="M11 1 L15 5 L11 9 L7 5 Z" fill={color} stroke="var(--color-tile)" strokeWidth="1" />
        </svg>
      )
    case 'dot':
      return (
        <svg width="22" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2.5" />
          <circle cx="11" cy="5" r="3.5" fill={color} stroke="var(--color-tile)" strokeWidth="1" />
        </svg>
      )
    default:
      return (
        <svg width="22" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="22" y2="4" stroke={color} strokeWidth="2.5" />
        </svg>
      )
  }
}

/** The key of a chart that is not a plain actual-against-target one (the light charts, the overlay, the 24-hour charts). Plain HTML. */
export function ChartKey({ items }: { items: KeyItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chart key">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch kind={item.kind} color={item.color} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
