import { useId, type ReactNode } from 'react'

const INPUT =
  'min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-field px-2 text-base font-normal text-ink disabled:opacity-60 aria-invalid:border-bad-line aria-invalid:border-2'

/** A label, the control, an optional hint and the error under it. The error is tied to the control for screen readers. */
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode }) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs font-normal text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-bad-ink">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  inputMode,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  type?: 'text' | 'date'
  inputMode?: 'decimal' | 'numeric' | 'text'
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} className={INPUT} />
      )}
    </Field>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  disabled,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  error?: string
  hint?: string
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} className={INPUT}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function CheckField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-11 items-start gap-2 text-sm font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand" />
      <span>
        {label}
        {hint && <span className="block text-xs font-normal text-ink-2">{hint}</span>}
      </span>
    </label>
  )
}

export const PRIMARY_BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60'
export const SECONDARY_BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-field px-4 text-sm font-semibold text-ink disabled:opacity-60'
