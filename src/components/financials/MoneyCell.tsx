import { signedPercent } from '../../lib/format'
import { compactMoney, variancePercent } from '../../financials'
import { moneyStatus, type MoneyKind } from '../../financials/status'
import { StatusBadge } from '../ui/StatusBadge'

/** One money figure against its budget, in thousands: the actual, the budget under it, the variance and the status. */
/** `compared` is the actual on the same basis as the budget (without cost that has no budget), when that differs from `line.actual`: the variance and the status use it. */
export function MoneyCell({ kind, line, compared }: { kind: MoneyKind; line: { actual: number | null; budget: number | null }; compared?: number | null }) {
  const basis = { actual: compared === undefined ? line.actual : compared, budget: line.budget }
  const variance = variancePercent(basis)
  return (
    <td className="num px-1 py-2.5 align-top sm:px-3">
      <div className="text-base font-semibold">
        <span className="sr-only">Actual </span>
        {compactMoney(line.actual)}
      </div>
      <div className="text-xs text-ink-3">
        vs<span className="sr-only"> budget</span> {line.budget === null ? 'no budget' : compactMoney(line.budget)}
      </div>
      <div className="mt-1 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="text-sm font-semibold">
          <span className="sr-only">Variance </span>
          {variance === null ? '–' : signedPercent(variance)}
        </span>
        <span className="hidden sm:inline">
          <StatusBadge status={moneyStatus(kind, basis)} compact />
        </span>
      </div>
    </td>
  )
}
