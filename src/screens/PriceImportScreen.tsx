import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProblemList } from '../components/exchange/ImportPreviewLists'
import { biggestMove, PriceChangeList, UnknownCommodityList } from '../components/exchange/PricePreviewLists'
import { WriteNotice } from '../components/setup/WriteNotice'
import { ChevronLeftIcon } from '../components/ui/icons'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TextField } from '../components/ui/fields'
import { ImportFileError, readTableFile } from '../exchange/file'
import { PRICE_COLUMNS, PRICE_TABLE, parsePriceTable, type PriceParseResult } from '../exchange/priceFile'
import { previewPrices, toPriceSave, type PriceContext, type PriceSave } from '../exchange/pricePreview'
import { buildCatalog, DEFAULT_CURRENCY } from '../setup/catalog'
import { effectiveFruitTypes } from '../setup/fruitTypes'
import { useCropData } from '../state/CropDataContext'
import { useWorkspace } from '../workspace/WorkspaceContext'

type Stage =
  | { name: 'choose' }
  | { name: 'reading'; file: string }
  | { name: 'preview'; file: string; sheet: string | null; parsed: PriceParseResult }
  | { name: 'saving' }
  | { name: 'done'; saved: PriceSave; prices: number }

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Bring in current market prices for the commodities (fruit types) from an Excel or CSV file: read it, show what would change, and only then save. */
export default function PriceImportScreen() {
  const { workbookCultivations, canWrite, signedInAs, decidedBy, setDecidedBy } = useCropData()
  const workspace = useWorkspace()
  const [stage, setStage] = useState<Stage>({ name: 'choose' })
  const [create, setCreate] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const needsName = signedInAs === null && decidedBy.trim() === ''

  const { data } = workspace
  const ctx = useMemo<PriceContext>(() => {
    const facilities = buildCatalog(workbookCultivations, data).facilities
    const currencies = new Set(facilities.map((f) => f.currency))
    const { types, seeded } = effectiveFruitTypes(data.fruitTypes)
    return { types, seeded, facilities, rates: data.rates, appCurrency: currencies.size === 1 ? [...currencies][0]! : DEFAULT_CURRENCY }
  }, [workbookCultivations, data])
  const preview = useMemo(() => (stage.name === 'preview' ? previewPrices(stage.parsed, ctx, create) : null), [stage, ctx, create])

  async function choose(file: File | undefined) {
    if (!file) return
    setError(null)
    setStage({ name: 'reading', file: file.name })
    try {
      const { cells, sheet } = await readTableFile(file, PRICE_TABLE)
      setCreate(new Set())
      setStage({ name: 'preview', file: file.name, sheet, parsed: parsePriceTable(cells, todayIso()) })
    } catch (e) {
      setError(e instanceof ImportFileError ? e.message : 'That file could not be read.')
      setStage({ name: 'choose' })
    }
    if (picker.current) picker.current.value = '' // the same file can be chosen again
  }

  function toggle(key: string, on: boolean) {
    setCreate((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function apply() {
    if (!preview) return
    const saved = toPriceSave(preview, ctx, { importedBy: signedInAs ?? decidedBy, importedAt: new Date().toISOString() })
    setStage({ name: 'saving' })
    // The commodities first: a facility price refers to one.
    if (saved.fruitTypes.length > 0 && !(await workspace.save('fruitTypes', saved.fruitTypes))) return failed('The prices were not saved')
    if (saved.rates.length > 0 && !(await workspace.save('rates', saved.rates))) return failed('The facility prices were not saved')
    setStage({ name: 'done', saved, prices: preview.changes.length })
  }

  function failed(what: string) {
    setError(`${what}${workspace.saveError ? `: ${workspace.saveError}` : '.'} Choose the file again to retry.`)
    setStage({ name: 'choose' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/data" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink hover:underline">
          <ChevronLeftIcon width={16} height={16} /> Data
        </Link>
        <h1 className="text-2xl font-semibold">Import market prices</h1>
        <p>
          Current market prices per commodity (fruit type), from an Excel (.xlsx) or CSV file. The columns are {PRICE_COLUMNS.join(', ')}; only Commodity and Price are needed. Commodity is a fruit type&apos;s name or code. Facility sets that facility&apos;s own price instead of the general one. Currency must match (USD unless the facility has another). Date is the day the price is for (today if empty). Unit is kg or lb (empty means kg). You see what would change before anything is saved.
        </p>
        <p className="mt-1">
          <a href={`${import.meta.env.BASE_URL}samples/market-prices-sample.csv`} download className="font-semibold text-ink underline">
            Download a sample file
          </a>{' '}
          (all current commodities, one Ontario price and one new commodity, Mini plum) to try it. The prices show on{' '}
          <Link to="/prices" className="font-semibold text-ink underline">Prices and costs</Link>, and Financials uses them.
        </p>
      </div>

      <WriteNotice what="import market prices" />

      {error && (
        <p role="alert" className="rounded-2xl border border-bad-line bg-bad-bg p-3 text-sm font-semibold text-bad-ink">
          {error}
        </p>
      )}

      {(stage.name === 'choose' || stage.name === 'reading') && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
          <label htmlFor="price-file" className="text-sm font-medium">
            Price file to import
          </label>
          <input
            ref={picker}
            id="price-file"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => void choose(e.target.files?.[0])}
            disabled={stage.name === 'reading'}
            className="w-full min-w-0 text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-4 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
          />
          <p role="status" className="text-sm text-ink-2">{stage.name === 'reading' ? `Reading ${stage.file}.` : 'An .xlsx or .csv file with a row per commodity.'}</p>
        </div>
      )}

      {stage.name === 'preview' && preview && (
        <section aria-label="Import preview" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold break-words">{stage.file}</h2>
            {stage.sheet && <p className="text-xs text-ink-3">Read the sheet “{stage.sheet}”.</p>}
          </div>

          {stage.parsed.missingColumns.length > 0 ? (
            <p role="alert" className="text-sm font-semibold text-bad-ink">
              The file has no {stage.parsed.missingColumns.length === 1 ? 'column' : 'columns'} called {stage.parsed.missingColumns.join(', ')}. Nothing was read. The first row must hold the column names Commodity and Price.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Count label="Prices that change" value={preview.changes.length} />
                <Count label="Unchanged, skipped" value={preview.unchanged.length} />
                <Count label="Unknown commodities" value={preview.unknown.length} />
                <Count label="Problems" value={preview.problems.length} />
              </dl>
              {stage.parsed.blankRows > 0 && <p className="text-sm">{stage.parsed.blankRows} empty {stage.parsed.blankRows === 1 ? 'row was' : 'rows were'} skipped.</p>}
              {biggestMove(preview.changes) && <p role="status" className="rounded-xl border border-warn-line bg-warn-bg p-2 text-sm text-warn-ink">{biggestMove(preview.changes)}</p>}
              <UnknownCommodityList unknown={preview.unknown} onToggle={toggle} disabled={!canWrite} />
              <PriceChangeList changes={preview.changes} />
              <ProblemList problems={preview.problems} />
              {preview.changes.length === 0 && <p className="text-sm font-semibold">There is nothing to import: every price in this file is already in the app.</p>}
              {preview.changes.length > 0 && signedInAs === null && (
                <TextField label="Your name" value={decidedBy} onChange={setDecidedBy} hint="Saved with the prices, as the source." error={needsName ? 'Type your name so the prices show who imported them.' : undefined} />
              )}
            </>
          )}

          <div className="flex flex-wrap gap-2">
            {stage.parsed.missingColumns.length === 0 && preview.changes.length > 0 && (
              <button type="button" onClick={() => void apply()} disabled={!canWrite || needsName} className={PRIMARY_BUTTON}>
                Apply {preview.changes.length} {preview.changes.length === 1 ? 'price' : 'prices'}
                {create.size > 0 && preview.unknown.some((u) => u.create) ? ' and create commodities' : ''}
              </button>
            )}
            <button type="button" onClick={() => setStage({ name: 'choose' })} className={SECONDARY_BUTTON}>
              Choose another file
            </button>
          </div>
        </section>
      )}

      {stage.name === 'saving' && (
        <p role="status" className="rounded-2xl border border-line bg-card p-4 text-sm">
          Saving the prices…
        </p>
      )}

      {stage.name === 'done' && (
        <div role="status" className="flex flex-col gap-2 rounded-2xl border border-ok-line bg-ok-bg p-4 text-sm text-ok-ink">
          <p className="font-semibold">Imported {stage.prices} {stage.prices === 1 ? 'price' : 'prices'}.</p>
          {stage.saved.created.length > 0 && <p>Created {stage.saved.created.length === 1 ? 'the commodity' : 'the commodities'} {stage.saved.created.join(', ')}. {stage.saved.created.length === 1 ? 'It has' : 'They have'} a placeholder weight range; enter the real specs on Commodities (fruit types).</p>}
          <p>Each price says where it came from. Example prices are no longer used in Financials.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/prices" className={SECONDARY_BUTTON}>Open Prices and costs</Link>
            <Link to="/financials" className={SECONDARY_BUTTON}>Open Financials</Link>
            <button type="button" onClick={() => setStage({ name: 'choose' })} className={SECONDARY_BUTTON}>
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
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
