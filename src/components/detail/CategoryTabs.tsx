import { CATEGORY_LABEL, CATEGORY_ORDER } from '../../config/kpis'
import type { Category } from '../../data/types'
import type { CategoryResult } from '../../scoring/summary'
import { STATUS_LABEL } from '../../scoring/score'
import { STATUS_SOLID } from '../ui/StatusBadge'

/** One tab per KPI category; the dot and the words carry that category's status for the selected week. */
export function CategoryTabs({
  value,
  onChange,
  categories,
}: {
  value: Category
  onChange: (category: Category) => void
  categories: CategoryResult[]
}) {
  return (
    <div role="tablist" aria-label="KPI category" className="grid grid-cols-5 gap-0.5 rounded-2xl border border-line bg-card p-1 sm:gap-1">
      {CATEGORY_ORDER.map((category) => {
        const result = categories.find((c) => c.category === category)!
        const selected = category === value
        const statusText = result.status ? STATUS_LABEL[result.status] : 'Not scored'
        return (
          <button
            key={category}
            role="tab"
            id={`tab-${category}`}
            aria-selected={selected}
            aria-controls="category-panel"
            onClick={() => onChange(category)}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0 text-[0.66rem] font-semibold sm:px-1 sm:text-sm ${
              selected ? 'bg-brand text-white' : 'text-ink-2 hover:bg-brand-soft'
            }`}
          >
            <span>{CATEGORY_LABEL[category]}</span>
            <span className={`flex items-center gap-0.5 text-[0.62rem] font-medium sm:gap-1 sm:text-xs ${selected ? 'text-white/90' : 'text-ink-3'}`}>
              <span className={`inline-block h-2 w-2 rounded-full ring-1 ${selected ? 'ring-field' : 'ring-transparent'} ${STATUS_SOLID[result.status ?? 'none']}`} aria-hidden="true" />
              {statusText}
            </span>
          </button>
        )
      })}
    </div>
  )
}
