import { Link } from 'react-router-dom'
import { ChevronRightIcon } from './icons'

export interface LinkCard {
  to: string
  title: string
  text: string
  /** A count shown beside the title, such as the open data checks. */
  badge?: number | null
}

/** A list of screens to open, one card each: the body of More and of Data. */
export function LinkCardList({ items }: { items: LinkCard[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.to}>
          <Link to={item.to} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm hover:bg-tile">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-lg font-semibold text-brand">
                {item.title}
                {item.badge ? <span className="rounded-full bg-bad px-2 text-xs leading-5 text-white">{item.badge} open</span> : null}
              </span>
              <span className="block text-sm text-ink-2">{item.text}</span>
            </span>
            <ChevronRightIcon width={20} height={20} className="shrink-0 text-ink-2" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
