import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChangedRowList, FlaggedNote, NewRowList, ProblemList } from '../components/exchange/ImportPreviewLists'
import { WriteNotice } from '../components/setup/WriteNotice'
import { ChevronLeftIcon } from '../components/ui/icons'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TextField } from '../components/ui/fields'
import { ImportFileError, readTableFile } from '../exchange/file'
import { parseKpiTable } from '../exchange/parse'
import { previewImport, toImportedRows, type ImportPreview } from '../exchange/preview'
import { useCropData } from '../state/CropDataContext'
import { useWorkspace } from '../workspace/WorkspaceContext'

/** Rows are saved this many at a time, so a big file does not freeze the screen and a request stays a sensible size. */
const SAVE_CHUNK = 4000

type Stage =
  | { name: 'choose' }
  | { name: 'reading'; file: string }
  | { name: 'preview'; file: string; sheet: string | null; preview: ImportPreview; missing: string[]; blank: number }
  | { name: 'saving'; done: number; total: number }
  | { name: 'done'; count: number }

/** Bring values in from an Excel or CSV file: read it, show what would change, and only then save. */
export default function ImportScreen() {
  const { data, cultivations, canWrite, signedInAs, decidedBy, setDecidedBy } = useCropData()
  const workspace = useWorkspace()
  const [stage, setStage] = useState<Stage>({ name: 'choose' })
  const [error, setError] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const needsName = signedInAs === null && decidedBy.trim() === ''

  async function choose(file: File | undefined) {
    if (!file) return
    setError(null)
    setStage({ name: 'reading', file: file.name })
    try {
      const { cells, sheet } = await readTableFile(file)
      const known = { cultivations: new Set(cultivations.map((c) => c.id)), kpis: new Set(data.kpis.map((k) => k.name)) }
      const parsed = parseKpiTable(cells, known)
      setStage({ name: 'preview', file: file.name, sheet, preview: previewImport(parsed, data.daily, cultivations), missing: parsed.missingColumns, blank: parsed.blankRows })
    } catch (e) {
      setError(e instanceof ImportFileError ? e.message : 'That file could not be read.')
      setStage({ name: 'choose' })
    }
    if (picker.current) picker.current.value = '' // the same file can be chosen again
  }

  async function apply(preview: ImportPreview) {
    const rows = toImportedRows(preview, { createdBy: signedInAs ?? decidedBy, createdAt: new Date().toISOString() })
    for (let done = 0; done < rows.length; done += SAVE_CHUNK) {
      setStage({ name: 'saving', done, total: rows.length })
      // Let the screen paint the progress before the next chunk is worked on.
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (!(await workspace.save('enteredRows', rows.slice(done, done + SAVE_CHUNK)))) {
        setError(`The import stopped after ${done} of ${rows.length} values${workspace.saveError ? `: ${workspace.saveError}` : '.'} Those ${done} are saved; undo them in the edit log, or choose the file again to bring in the rest.`)
        setStage({ name: 'choose' })
        return
      }
    }
    setStage({ name: 'done', count: rows.length })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/data" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink hover:underline">
          <ChevronLeftIcon width={16} height={16} /> Data
        </Link>
        <h1 className="text-2xl font-semibold">Import</h1>
        <p>
          Bring in values from an Excel (.xlsx) or CSV file. It needs the columns Date, Cultivation, KPI, Actual and Target, the same as the KPIs sheet of the workbook, so the workbook itself and this app&apos;s export both work. Other columns are ignored. You see what would change before anything is saved.
        </p>
      </div>

      <WriteNotice what="import data" />

      {error && (
        <p role="alert" className="rounded-2xl border border-bad-line bg-bad-bg p-3 text-sm font-semibold text-bad-ink">
          {error}
        </p>
      )}

      {(stage.name === 'choose' || stage.name === 'reading') && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
          <label htmlFor="import-file" className="text-sm font-medium">
            File to import
          </label>
          <input
            ref={picker}
            id="import-file"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => void choose(e.target.files?.[0])}
            disabled={stage.name === 'reading'}
            className="w-full min-w-0 text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-4 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
          />
          <p role="status" className="text-sm text-ink-2">
            {stage.name === 'reading' ? `Reading ${stage.file}. A big workbook takes a few seconds.` : 'An .xlsx or .csv file. A file the size of the workbook (about 16,000 rows) is fine.'}
          </p>
        </div>
      )}

      {stage.name === 'preview' && (
        <PreviewCard
          stage={stage}
          canApply={canWrite && !needsName}
          needsName={needsName}
          signedIn={signedInAs !== null}
          name={decidedBy}
          onName={setDecidedBy}
          onApply={() => void apply(stage.preview)}
          onAnother={() => setStage({ name: 'choose' })}
        />
      )}

      {stage.name === 'saving' && (
        <p role="status" className="rounded-2xl border border-line bg-card p-4 text-sm">
          Saving {stage.done} of {stage.total} values…
        </p>
      )}

      {stage.name === 'done' && (
        <div role="status" className="flex flex-col gap-2 rounded-2xl border border-ok-line bg-ok-bg p-4 text-sm text-ok-ink">
          <p className="font-semibold">Imported {stage.count} {stage.count === 1 ? 'value' : 'values'}.</p>
          <p>They show as Imported in the weekly table and in the edit log, where each import can be undone.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/edits" className={SECONDARY_BUTTON}>
              Open the edit log
            </Link>
            <button type="button" onClick={() => setStage({ name: 'choose' })} className={SECONDARY_BUTTON}>
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewCard({
  stage,
  canApply,
  needsName,
  signedIn,
  name,
  onName,
  onApply,
  onAnother,
}: {
  stage: Extract<Stage, { name: 'preview' }>
  canApply: boolean
  needsName: boolean
  signedIn: boolean
  name: string
  onName: (name: string) => void
  onApply: () => void
  onAnother: () => void
}) {
  const { preview, missing } = stage
  const changes = preview.newRows.length + preview.changedRows.length
  return (
    <section aria-label="Import preview" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold break-words">{stage.file}</h2>
        {stage.sheet && <p className="text-xs text-ink-3">Read the sheet “{stage.sheet}”.</p>}
      </div>

      {missing.length > 0 ? (
        <p role="alert" className="text-sm font-semibold text-bad-ink">
          The file has no {missing.length === 1 ? 'column' : 'columns'} called {missing.join(', ')}. Nothing was read. The first row must hold the column names Date, Cultivation, KPI, Actual and Target.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Count label="New days" value={preview.newRows.length} />
            <Count label="Changed values" value={preview.changedRows.length} />
            <Count label="Unchanged, skipped" value={preview.unchanged} />
            <Count label="Problems" value={preview.problems.length} />
          </dl>
          <p className="text-sm">An empty cell in the file leaves the value the day has now. {stage.blank > 0 && `${stage.blank} empty ${stage.blank === 1 ? 'row was' : 'rows were'} skipped.`}</p>

          <FlaggedNote flagged={preview.flagged} examples={preview.flaggedExamples} />
          <NewRowList rows={preview.newRows} />
          <ChangedRowList rows={preview.changedRows} />
          <ProblemList problems={preview.problems} />

          {changes === 0 && <p className="text-sm font-semibold">There is nothing to import: every day in this file is already in the app with the same values.</p>}
          {changes > 0 && !signedIn && <TextField label="Your name" value={name} onChange={onName} hint="Saved with the import." error={needsName ? 'Type your name so the edit log can show who imported.' : undefined} />}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {missing.length === 0 && changes > 0 && (
          <button type="button" onClick={onApply} disabled={!canApply} className={PRIMARY_BUTTON}>
            Import {changes} {changes === 1 ? 'value' : 'values'}
          </button>
        )}
        <button type="button" onClick={onAnother} className={SECONDARY_BUTTON}>
          Choose another file
        </button>
      </div>
    </section>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line-soft bg-tile p-2.5">
      <dt className="text-xs font-medium text-ink-2">{label}</dt>
      <dd className="num text-xl font-semibold">{value.toLocaleString('en-US')}</dd>
    </div>
  )
}
