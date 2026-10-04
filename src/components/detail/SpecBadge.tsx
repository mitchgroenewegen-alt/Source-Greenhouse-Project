import type { SpecState } from '../../setup/fruitTypes'
import { StatusBadge } from '../ui/StatusBadge'

const TEXT: Record<SpecState, string> = { under: 'Under spec', within: 'Within spec', over: 'Over spec' }

/** Under, within or over a fruit type's weight range. Within uses the "on track" look, the other two the "watch" look; no status of its own. */
export function SpecBadge({ state }: { state: SpecState }) {
  return <StatusBadge status={state === 'within' ? 'green' : 'amber'} label={TEXT[state]} className="ml-1 align-middle" />
}
