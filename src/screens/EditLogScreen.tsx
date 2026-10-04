import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EditLogEntry } from '../components/editing/EditLogEntry'
import { WriteNotice } from '../components/setup/WriteNotice'
import { ChevronLeftIcon } from '../components/ui/icons'
import { FilterSelect } from '../components/ui/FilterSelect'
import { groupEdits, type LogEntry } from '../editing/log'
import { useCropData } from '../state/CropDataContext'
import { useWorkspace } from '../workspace/WorkspaceContext'

const ALL = 'all'

/** Every change made to a value in the app, newest first, each with Undo. */
export default function EditLogScreen() {
  const { data: merged, undoEdits, canWrite } = useCropData()
  const workspace = useWorkspace()
  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useState<string | null>(null)
  const cultivation = params.get('cultivation') ?? ALL

  const entries = useMemo(() => groupEdits(workspace.data.valueEdits), [workspace.data.valueEdits])
  const shown = cultivation === ALL ? entries : entries.filter((e) => e.cultivation === cultivation)
  // Days that have a row, so a weekly number counts the same days the weekly table does.
  const datesOf = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const r of merged.daily) {
      const key = `${r.cultivation}|${r.kpi}`
      const set = map.get(key) ?? new Set<string>()
      set.add(r.date)
      map.set(key, set)
    }
    return map
  }, [merged.daily])

  const choices = [
    { value: ALL, label: 'All cultivations' },
    ...[...new Set(entries.map((e) => e.cultivation))].sort().map((id) => ({ value: id, label: id })),
  ]
  // A link may name a cultivation that has no edits (any more); it stays selectable so the filter does not jump.
  if (cultivation !== ALL && !choices.some((c) => c.value === cultivation)) choices.push({ value: cultivation, label: cultivation })

  function undo(entry: LogEntry) {
    undoEdits(entry)
    setNotice(entry.source === 'corrected' ? 'Correction undone. The data check is open again.' : 'Edit undone. The earlier values are back.')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/more" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink hover:underline">
          <ChevronLeftIcon width={16} height={16} /> More
        </Link>
        <h1 className="text-2xl font-semibold">Edit log</h1>
        <p className="text-sm">Every change made to a value in the app, newest first. The workbook itself is never changed, so undoing an edit brings back the value it had before.</p>
      </div>

      <WriteNotice what="undo edits" />
      {notice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ok-line bg-ok-bg p-3 text-sm text-ok-ink">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="min-h-9 rounded-lg px-2 font-semibold">
            Dismiss
          </button>
        </div>
      )}

      <FilterSelect
        label="Cultivation"
        options={choices}
        value={cultivation}
        onChange={(value) => setParams(value === ALL ? {} : { cultivation: value }, { replace: true })}
        className="sm:max-w-xs"
      />

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm">{entries.length === 0 ? 'Nothing has been edited yet. Use Edit budget or Edit target on a KPI of a cultivation to change a plan value.' : 'No edits for this cultivation.'}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((entry) => (
            <EditLogEntry key={entry.key} entry={entry} canWrite={canWrite} onUndo={() => undo(entry)} hasRow={(date) => entry.kpi === null || (datesOf.get(`${entry.cultivation}|${entry.kpi}`)?.has(date) ?? false)} />
          ))}
        </ul>
      )}
    </div>
  )
}
