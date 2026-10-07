/** A row of mutually exclusive choices (filters). Wraps instead of scrolling on narrow screens. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm font-medium text-ink-2">{label}</span>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
              active ? 'border-brand bg-brand text-white' : 'border-line-soft bg-tile text-ink-2 hover:bg-brand-soft'
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className={`ml-1.5 text-xs ${active ? 'text-white/80' : 'text-ink-3'}`}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
