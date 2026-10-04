import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChangedReadingList, ClimateProblemList, CoverageList, NewReadingList } from '../components/climate/ClimatePreviewLists'
import { WriteNotice } from '../components/setup/WriteNotice'
import { ChevronLeftIcon } from '../components/ui/icons'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TextField } from '../components/ui/fields'
import { CLIMATE_COLUMNS, CLIMATE_TABLE, MAX_CLIMATE_ROWS, parseClimateTable, previewClimateImport, toClimateReadings, type ClimatePreview } from '../climate/import'
import { ImportFileError, readTableFile } from '../exchange/file'
import { useCropData } from '../state/CropDataContext'
import { useWorkspace } from '../workspace/WorkspaceContext'

/** Readings are saved this many at a time, so a big file does not freeze the screen. */
const SAVE_CHUNK = 4000

type Stage =
  | { name: 'choose' }
  | { name: 'reading'; file: string }
  | { name: 'preview'; file: string; sheet: string | null; preview: ClimatePreview; missing: string[]; blank: number; tooMany: number | null }
  | { name: 'saving'; done: number; total: number }
  | { name: 'done'; count: number; cultivations: string[] }

/** Bring in finer climate data from a climate computer export: read the file, show what would be saved, and only then save. */
export default function ClimateImportScreen() {
  const { cultivations, canWrite, signedInAs, decidedBy, setDecidedBy } = useCropData()
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
      const { cells, sheet } = await readTableFile(file, CLIMATE_TABLE)
      const parsed = parseClimateTable(cells, new Set(cultivations.map((c) => c.id)))
      setStage({ name: 'preview', file: file.name, sheet, preview: previewClimateImport(parsed, workspace.data.climateReadings), missing: parsed.missingColumns, blank: parsed.blankRows, tooMany: parsed.tooMany })
    } catch (e) {
      setError(e instanceof ImportFileError ? e.message : 'That file could not be read.')
      setStage({ name: 'choose' })
    }
    if (picker.current) picker.current.value = '' // the same file can be chosen again
  }

  async function apply(preview: ClimatePreview) {
    const rows = toClimateReadings(preview, { createdBy: signedInAs ?? decidedBy, createdAt: new Date().toISOString() })
    for (let done = 0; done < rows.length; done += SAVE_CHUNK) {
      setStage({ name: 'saving', done, total: rows.length })
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (!(await workspace.save('climateReadings', rows.slice(done, done + SAVE_CHUNK)))) {
        setError(`The import stopped after ${done} of ${rows.length} readings${workspace.saveError ? `: ${workspace.saveError}` : '.'} Those ${done} are saved; choose the file again to bring in the rest.`)
        setStage({ name: 'choose' })
        return
      }
    }
    setStage({ name: 'done', count: rows.length, cultivations: [...new Set(rows.map((r) => r.cultivation))].sort() })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/data" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink hover:underline">
          <ChevronLeftIcon width={16} height={16} /> Data
        </Link>
        <h1 className="text-2xl font-semibold">Import climate readings</h1>
        <p>
          Finer climate data from a climate computer export, as an Excel (.xlsx) or CSV file with the columns {CLIMATE_COLUMNS.join(', ')}. One row is one reading: the value the greenhouse realised and the setpoint it was steered to, for a parameter such as Temperature, Relative humidity or CO2. Setpoint may be empty; other columns are ignored. Timestamps are read as written (2025-08-20 14:00), with no time zone applied. A file may have up to {MAX_CLIMATE_ROWS.toLocaleString('en-US')} rows, so send a month at a time. You see what would be saved before anything is.
        </p>
        <p className="mt-1">
          <a href={`${import.meta.env.BASE_URL}samples/climate-sample.csv`} download className="font-semibold text-ink underline">
            Download a small sample file
          </a>{' '}
          (two days of PA-P2-TOV) to try it. The readings show on the Climate tab of the cultivation, under Hour by hour.
        </p>
      </div>

      <WriteNotice what="import climate readings" />

      {error && (
        <p role="alert" className="rounded-2xl border border-bad-line bg-bad-bg p-3 text-sm font-semibold text-bad-ink">
          {error}
        </p>
      )}

      {(stage.name === 'choose' || stage.name === 'reading') && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
          <label htmlFor="climate-file" className="text-sm font-medium">
            Climate file to import
          </label>
          <input
            ref={picker}
            id="climate-file"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => void choose(e.target.files?.[0])}
            disabled={stage.name === 'reading'}
            className="w-full min-w-0 text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-4 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
          />
          <p role="status" className="text-sm text-ink-2">
            {stage.name === 'reading' ? `Reading ${stage.file}.` : `An .xlsx or .csv file of up to ${MAX_CLIMATE_ROWS.toLocaleString('en-US')} rows.`}
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
          Saving {stage.done} of {stage.total} readings…
        </p>
      )}

      {stage.name === 'done' && (
        <div role="status" className="flex flex-col gap-2 rounded-2xl border border-ok-line bg-ok-bg p-4 text-sm text-ok-ink">
          <p className="font-semibold">Imported {stage.count.toLocaleString('en-US')} {stage.count === 1 ? 'reading' : 'readings'}.</p>
          <p>Open the Climate tab of {stage.cultivations.length === 1 ? 'the cultivation' : 'a cultivation'} and look under Hour by hour.</p>
          <div className="flex flex-wrap gap-2">
            {stage.cultivations.map((id) => (
              <Link key={id} to={`/cultivation/${encodeURIComponent(id)}`} className={SECONDARY_BUTTON}>
                Open {id}
              </Link>
            ))}
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
  const { preview, missing, tooMany } = stage
  const changes = preview.newRows.length + preview.changedRows.length
  const unreadable = missing.length > 0 || tooMany !== null
  return (
    <section aria-label="Import preview" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold break-words">{stage.file}</h2>
        {stage.sheet && <p className="text-xs text-ink-3">Read the sheet “{stage.sheet}”.</p>}
      </div>

      {missing.length > 0 && (
        <p role="alert" className="text-sm font-semibold text-bad-ink">
          The file has no {missing.length === 1 ? 'column' : 'columns'} called {missing.join(', ')}. Nothing was read. The first row must hold the column names {CLIMATE_COLUMNS.join(', ')} (Setpoint may be left out).
        </p>
      )}
      {tooMany !== null && (
        <p role="alert" className="text-sm font-semibold text-bad-ink">
          The file has {tooMany.toLocaleString('en-US')} rows; the limit is {MAX_CLIMATE_ROWS.toLocaleString('en-US')} per import. Nothing was read. Split it, for example by month, and import the parts one after the other.
        </p>
      )}

      {!unreadable && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Count label="New readings" value={preview.newRows.length} />
            <Count label="Changed readings" value={preview.changedRows.length} />
            <Count label="Unchanged, skipped" value={preview.unchanged} />
            <Count label="Problems" value={preview.problems.length} />
          </dl>
          {stage.blank > 0 && <p className="text-sm">{stage.blank} empty {stage.blank === 1 ? 'row was' : 'rows were'} skipped.</p>}
          <CoverageList coverage={preview.coverage} />
          <NewReadingList rows={preview.newRows} />
          <ChangedReadingList rows={preview.changedRows} />
          <ClimateProblemList problems={preview.problems} />
          {changes === 0 && <p className="text-sm font-semibold">There is nothing to import: every reading in this file is already in the app with the same values.</p>}
          {changes > 0 && !signedIn && <TextField label="Your name" value={name} onChange={onName} hint="Saved with the readings." error={needsName ? 'Type your name so the readings show who imported them.' : undefined} />}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {!unreadable && changes > 0 && (
          <button type="button" onClick={onApply} disabled={!canApply} className={PRIMARY_BUTTON}>
            Import {changes.toLocaleString('en-US')} {changes === 1 ? 'reading' : 'readings'}
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
