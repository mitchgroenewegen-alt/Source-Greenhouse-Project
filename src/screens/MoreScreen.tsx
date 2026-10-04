import { Link } from 'react-router-dom'
import { ChevronRightIcon } from '../components/ui/icons'

const ITEMS = [
  { to: '/setup', title: 'Setup', text: 'Facilities, greenhouses and cultivations: add, edit and archive them.' },
  { to: '/fruit-types', title: 'Fruit types and specs', text: 'The weight range each fruit type should have, and its price.' },
  { to: '/about', title: 'About', text: 'How the scores work, the data period, assumptions and what was left out.' },
]

export default function MoreScreen() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">More</h1>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm hover:bg-tile">
              <span className="min-w-0">
                <span className="block text-lg font-semibold text-brand">{item.title}</span>
                <span className="block text-sm text-ink-2">{item.text}</span>
              </span>
              <ChevronRightIcon width={20} height={20} className="shrink-0 text-ink-2" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
