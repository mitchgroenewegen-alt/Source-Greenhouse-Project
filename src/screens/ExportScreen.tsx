import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeftIcon } from '../components/ui/icons'
import { PRIMARY_BUTTON } from '../components/ui/fields'
import { downloadFile } from '../exchange/download'
import { buildExport, exportFileName } from '../exchange/exportBook'
import { writeWorkbook } from '../exchange/xlsxFile'
import { useCropData } from '../state/CropDataContext'
import { useWorkspace } from '../workspace/WorkspaceContext'

/** One button: everything in the app, with the edits and entries applied, as an Excel workbook. */
export default function ExportScreen() {
  const { data, workbook, flags, decisions, point, signedInAs, decidedBy } = useCropData()
  const workspace = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  async function run() {
    setBusy(true)
    setDone(null)
    setFailed(false)
    try {
      const now = new Date()
      // Let the button show "Exporting…" before the (few seconds of) work starts.
      await new Promise((resolve) => setTimeout(resolve, 0))
      const sheets = buildExport({ now, who: signedInAs ?? decidedBy, workbook, merged: data, workspace: workspace.data, flags, decisions, point })
      const name = exportFileName(now)
      downloadFile(await writeWorkbook(sheets), name)
      setDone(name)
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  const applied = workspace.data.valueEdits.length + workspace.data.enteredRows.length
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/data" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink hover:underline">
          <ChevronLeftIcon width={16} height={16} /> Data
        </Link>
        <h1 className="text-2xl font-semibold">Export</h1>
        <p>Everything in the app as one Excel file, with your edits, corrections and entries applied. The workbook&apos;s own values are kept next to them.</p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">What is in the file</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          <li><strong>Read me:</strong> when it was exported, by whom, the period, what each sheet holds and how many edits and entries are applied ({applied} now).</li>
          <li><strong>Greenhouses:</strong> every cultivation, new ones included, with fruit type, planned end date and whether it is archived.</li>
          <li><strong>KPIs:</strong> {data.daily.length.toLocaleString('en-US')} rows, one per cultivation, date and KPI, with the values in use, the workbook&apos;s original values and where each row comes from. It can be imported again.</li>
          <li><strong>Weekly scores:</strong> actual, budget or target, variance and status for each cultivation, week and KPI.</li>
          <li><strong>Data checks:</strong> every flagged value and the decision made about it.</li>
          <li><strong>Edit log</strong> and <strong>Settings</strong> (fruit types and specs).</li>
        </ul>
        <div className="flex flex-col items-start gap-2">
          <button type="button" onClick={() => void run()} disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? 'Exporting…' : 'Export to Excel'}
          </button>
          {busy && <p role="status" className="text-sm">Making the file. This takes a few seconds.</p>}
          {done && (
            <p role="status" className="text-sm font-semibold">
              Downloaded {done}.
            </p>
          )}
          {failed && (
            <p role="alert" className="text-sm font-semibold text-bad-ink">
              The file could not be made. Try again.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
