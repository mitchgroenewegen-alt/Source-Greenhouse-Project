/** A labelled drop-down for one filter. Used instead of a row of chips on phones, where the chips take a whole screen. */
export function FilterSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-0.5 text-xs font-medium text-ink-2 ${className}`}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        // 16px on a phone: smaller text makes iOS zoom the page when the menu opens.
        className="min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-field px-2 text-base font-semibold text-ink md:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
