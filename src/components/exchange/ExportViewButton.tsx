import { useState } from 'react'
import { downloadFile } from '../../exchange/download'
import { exportFileName } from '../../exchange/exportBook'
import type { SheetSpec } from '../../exchange/sheets'
import { writeWorkbook } from '../../exchange/xlsxFile'
import { SECONDARY_BUTTON } from '../ui/fields'

/** "Export this view": downloads the table of the screen for the selected week as an .xlsx. `build` runs when it is pressed. */
export function ExportViewButton({ build, filePart }: { build: () => SheetSpec[]; filePart: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function run() {
    setBusy(true)
    setFailed(false)
    try {
      downloadFile(await writeWorkbook(build()), exportFileName(new Date(), filePart))
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={() => void run()} disabled={busy} className={SECONDARY_BUTTON}>
        {busy ? 'Exporting…' : 'Export this view'}
      </button>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-bad-ink">
          The file could not be made. Try again.
        </p>
      )}
    </div>
  )
}
