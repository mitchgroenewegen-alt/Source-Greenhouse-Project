import { Link } from 'react-router-dom'
import { DATA_STATE_LABEL, type DataState } from '../../setup/dataState'

/** What a cultivation card or detail screen shows instead of scores when there is nothing to score yet. */
export function NoDataTile({ state }: { state: Exclude<DataState, 'ready'> }) {
  return (
    <div role="status" className="rounded-xl border border-line-soft bg-tile p-4 text-center">
      <p className="text-lg font-semibold">{DATA_STATE_LABEL[state]}</p>
      <p className="mt-1 text-sm text-ink-2">
        {state === 'no-budget' ? (
          <>
            It has no budget or target values, so there is nothing to score. Copy them from another cultivation of the same fruit type on{' '}
            <Link to="/setup" className="font-semibold text-brand underline">
              Setup
            </Link>
            .
          </>
        ) : (
          'It has budgets, but nothing has been recorded yet, so there is nothing to score.'
        )}
      </p>
    </div>
  )
}
