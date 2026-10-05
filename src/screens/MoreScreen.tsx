import { LinkCardList } from '../components/ui/LinkCardList'

const ITEMS = [
  { to: '/forecast', title: 'Forecast', text: 'Expected harvest for the next six weeks, and how good that forecast has been.' },
  { to: '/setup', title: 'Setup', text: 'Facilities, greenhouses and cultivations: add, edit and archive them.' },
  { to: '/fruit-types', title: 'Commodities (fruit types)', text: 'Add a commodity, and set the weight range and price of each fruit type. Prices per facility are on Prices and costs.' },
  { to: '/prices', title: 'Prices and costs', text: 'Heat, electricity and water rates per facility, and the price per kg for each commodity. Market prices can be imported.' },
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
