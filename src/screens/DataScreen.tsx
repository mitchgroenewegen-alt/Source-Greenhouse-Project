import { LinkCardList } from '../components/ui/LinkCardList'
import { useCropData } from '../state/CropDataContext'

/** Everything about the numbers themselves: checking them, typing them in, bringing a spreadsheet in, taking one out. */
export default function DataScreen() {
  const { openReviewGroups } = useCropData()
  const items = [
    { to: '/checks', title: 'Data checks', text: 'Inputs that look wrong: confirm them, correct them or leave them out.', badge: openReviewGroups().length },
    { to: '/data/enter', title: 'Enter data', text: 'Type in a day of production, a weekly crop registration or a single value.' },
    { to: '/data/import', title: 'Import', text: 'Add or change values from an Excel or CSV file, after a preview.' },
    { to: '/data/export', title: 'Export', text: 'Download everything, with your edits and entries applied, as one Excel file.' },
    { to: '/edits', title: 'Edit log', text: 'Every edited budget, target, correction, entry and import, with who and why, and Undo.' },
  ]
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Data</h1>
      <LinkCardList items={items} />
    </div>
  )
}
