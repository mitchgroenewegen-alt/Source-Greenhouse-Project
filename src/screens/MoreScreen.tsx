import { LinkCardList } from '../components/ui/LinkCardList'

const ITEMS = [
  { to: '/setup', title: 'Setup', text: 'Facilities, greenhouses and cultivations: add, edit and archive them.' },
  { to: '/fruit-types', title: 'Fruit types and specs', text: 'The weight range each fruit type should have, and its price.' },
  { to: '/about', title: 'About', text: 'How the scores work, the data period, assumptions and what was left out.' },
]

export default function MoreScreen() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">More</h1>
      <LinkCardList items={ITEMS} />
    </div>
  )
}
