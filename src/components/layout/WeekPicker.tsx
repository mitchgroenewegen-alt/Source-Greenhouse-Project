import { formatRange, shortWeek } from '../../data/dates'
import { useCropData } from '../../state/CropDataContext'
import { useView } from '../../state/ViewContext'

export function WeekPicker() {
  const { weeks } = useCropData()
  const { week, setWeek } = useView()
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink-2">
      <span className="sr-only sm:not-sr-only">Week</span>
      <select
        value={week}
        onChange={(e) => setWeek(e.target.value)}
        className="min-h-10 w-full min-w-0 max-w-[14rem] rounded-lg border border-line-strong bg-field px-2 text-sm font-semibold text-ink"
      >
        {[...weeks].reverse().map((w) => (
          <option key={w.id} value={w.id}>
            {shortWeek(w.id)} · {formatRange(w.start, w.end).replace(/ \d{4}$/, '')}
          </option>
        ))}
      </select>
    </label>
  )
}
