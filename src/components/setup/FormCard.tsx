import type { FormEvent, ReactNode } from 'react'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../ui/fields'

/** The frame of a Setup form: a title, the fields, and Save and Cancel. */
export function FormCard({
  title,
  submitLabel,
  saving,
  disabled,
  onSubmit,
  onCancel,
  children,
}: {
  title: string
  submitLabel: string
  saving: boolean
  disabled: boolean
  onSubmit: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <form onSubmit={submit} noValidate aria-label={title} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={disabled || saving} className={PRIMARY_BUTTON}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
          Cancel
        </button>
      </div>
    </form>
  )
}
