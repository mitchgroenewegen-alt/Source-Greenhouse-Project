import { STATUS_LABEL, type Status } from '../../scoring/score'
import { AlertIcon, CheckIcon, CrossIcon, DashIcon } from './icons'

const STYLE: Record<Status | 'none', string> = {
  green: 'bg-ok-bg text-ok-ink border-ok-line',
  amber: 'bg-warn-bg text-warn-ink border-warn-line',
  red: 'bg-bad-bg text-bad-ink border-bad-line',
  none: 'bg-none-bg text-none-ink border-none-line',
}

const ICON = { green: CheckIcon, amber: AlertIcon, red: CrossIcon, none: DashIcon }

/** Status as colour AND an icon AND words, so it never relies on colour alone. */
export function StatusBadge({
  status,
  label,
  className = '',
  compact = false,
}: {
  status: Status | null
  label?: string
  className?: string
  /** Tight spots (table cells on a phone): drops the icon below the sm breakpoint. The words and the colour stay. */
  compact?: boolean
}) {
  const key = status ?? 'none'
  const Icon = ICON[key]
  const text = label ?? (status ? STATUS_LABEL[status] : 'Not scored')
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap gap-1 rounded-full border py-0.5 text-xs font-semibold ${compact ? 'px-1.5 sm:px-2' : 'px-2'} ${STYLE[key]} ${className}`}
    >
      <Icon width={13} height={13} className={compact ? 'hidden sm:block' : undefined} />
      {text}
    </span>
  )
}

/** The status colour as a thin bar or dot, for places that already carry a text label next to it. */
export const STATUS_SOLID: Record<Status | 'none', string> = {
  green: 'bg-ok',
  amber: 'bg-warn',
  red: 'bg-bad',
  none: 'bg-none-line',
}
