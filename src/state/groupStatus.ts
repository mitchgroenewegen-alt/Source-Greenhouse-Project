import type { FlagGroup } from '../flags'
import type { Decision } from '../storage'

export type GroupStatus = 'open' | 'partial' | 'decided'

/** A group is decided when every one of its cells has a decision. */
export function groupStatus(group: FlagGroup, decisionById: ReadonlyMap<string, Decision>): GroupStatus {
  const decided = group.flags.filter((f) => decisionById.has(f.id)).length
  if (decided === 0) return 'open'
  return decided === group.flags.length ? 'decided' : 'partial'
}

/** Missing values are information, not something that holds a number back, so they are counted apart. */
export const needsReview = (group: FlagGroup) => group.rule !== 'missing-value'
