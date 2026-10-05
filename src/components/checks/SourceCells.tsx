import { useMemo, useState } from 'react'
import { kpiConfig, planWord } from '../../config/kpis'
import { formatDate } from '../../data/dates'
import { cellText, daysAround, displayCellRef, FIELD_LETTER, rowOf, rowsAround, SHEET_COLUMNS, SOURCE_SHEET, sourceIndex } from '../../data/sourceCells'
import type { Flag } from '../../flags'
import { useCropData } from '../../state/CropDataContext'

/** Where a flagged value sits in the workbook: its row number, or null when it is not from the workbook. */
export function useFlagSource(flag: Pick<Flag, 'cultivation' | 'kpi' | 'date' | 'field'>) {
  const { workbook, enteredCell } = useCropData()
  const index = useMemo(() => sourceIndex(workbook), [workbook])
  const origin = enteredCell(flag.cultivation, flag.kpi, flag.date)
  const row = origin ? undefined : rowOf(index, flag.cultivation, flag.kpi, flag.date)
  const letter = FIELD_LETTER[flag.field]
  return {
    index,
    row,
    letter,
    ref: row === undefined ? null : displayCellRef(letter, row),
    /** Typed in or imported (or a cultivation made in the app): there is no workbook cell. */
    origin: row === undefined ? (origin === 'imported' ? 'Imported' : 'Entered in the app') : null,
  }
}

/** The name of the flagged column as the card says it: Actual, or for a budget KPI "Budget (Target column)". */
function columnName(flag: Pick<Flag, 'kpi' | 'field'>): string {
  if (flag.field === 'actual') return 'Actual'
  return planWord(kpiConfig(flag.kpi)) === 'budget' ? 'Budget, the Target column' : 'Target'
}

/** The "Show in workbook" button of one flagged value; the panel (SourceCells) goes where the caller puts it, with id cells-<flag id>. */
export function FlagSourceToggle({ flag, open, onToggle }: { flag: Flag; open: boolean; onToggle: () => void }) {
  const { ref, origin } = useFlagSource(flag)
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={`cells-${flag.id}`}
      aria-label={`${open ? 'Hide' : 'Show'} in workbook${ref ? `, cell ${ref}` : `: ${origin}`}`}
      onClick={onToggle}
      className="min-h-9 whitespace-nowrap rounded-lg px-1.5 text-xs font-semibold text-brand underline-offset-2 hover:underline sm:text-sm"
    >
      {open ? 'Hide' : 'Show'} <span className="num">{ref ?? origin}</span>
    </button>
  )
}

const HIGHLIGHT = 'font-bold outline outline-[3px] -outline-offset-[3px] outline-ink bg-field'

/** The cell, a grid of the rows around it in the sheet, and the same KPI on the days around it. Values are the workbook's own. */
export function SourceCells({ flag }: { flag: Flag }) {
  const { index, row, letter, ref, origin } = useFlagSource(flag)
  const [allColumns, setAllColumns] = useState(false)
  const around = useMemo(() => (row === undefined ? [] : rowsAround(index, row)), [index, row])
  const days = useMemo(() => daysAround(index, flag.cultivation, flag.kpi, flag.date), [index, flag.cultivation, flag.kpi, flag.date])

  if (row === undefined || ref === null) {
    return <p className="rounded-lg bg-tile px-2.5 py-2 text-sm">{origin}: this value is not in the original workbook, so there is no cell to show.</p>
  }

  // Company is the same on every row and is not kept in the data file, so column C is left out of the grid.
  const columns = SHEET_COLUMNS.filter((c) => c.field !== 'company' && (allColumns || c.shownByDefault))
  const field = flag.field
  const unit = kpiConfig(flag.kpi).unit

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-tile p-2.5 text-sm">
      <p>
        From the workbook: sheet {SOURCE_SHEET}, cell <strong className="num">{ref}</strong> ({columnName(flag)}){flag.value === null ? ', empty' : ''}
      </p>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2">
          <h4 className="text-xs font-semibold text-ink-2">Rows around it in the sheet</h4>
          <button type="button" aria-pressed={allColumns} onClick={() => setAllColumns(!allColumns)} className="min-h-9 text-xs font-semibold text-brand hover:underline">
            {allColumns ? 'Fewer columns' : 'All columns'}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line-soft" tabIndex={0} role="region" aria-label={`Rows around ${ref} in the sheet`}>
          <table className="num w-full border-collapse text-xs">
            <caption className="sr-only">Rows {around[0]!.row} to {around.at(-1)!.row} of the {SOURCE_SHEET} sheet, as in the workbook. The flagged cell is {ref}.</caption>
            <thead>
              <tr className="text-ink-2">
                <th scope="col" className="sticky left-0 bg-tile px-1.5 py-1 text-right font-semibold"><span className="sr-only">Row</span></th>
                {columns.map((c) => (
                  <th key={c.letter} scope="col" className="whitespace-nowrap px-1.5 py-1 text-left font-semibold">
                    {c.letter}
                    <span className="block text-[11px] font-normal">{c.header}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {around.map((r) => {
                const flagged = r.row === row
                return (
                  <tr key={r.row} className={`border-t border-line-soft ${flagged ? 'bg-field' : ''}`}>
                    <th scope="row" className={`sticky left-0 px-1.5 py-1 text-right font-semibold ${flagged ? 'bg-field' : 'bg-tile'}`}>
                      {r.row.toLocaleString('en-US')}
                    </th>
                    {columns.map((c) => {
                      const hit = flagged && c.field === field
                      const text = cellText(index, r.data, c.field)
                      return (
                        <td key={c.letter} className={`whitespace-nowrap px-1.5 py-1 ${hit ? HIGHLIGHT : ''}`} aria-label={hit ? `Flagged cell ${ref}: ${text === '' ? 'empty' : text}` : undefined}>
                          {text === '' ? <span className="text-ink-3">{hit ? '(empty)' : ''}</span> : c.field === 'date' ? formatDate(text) : text}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold text-ink-2">
          Same KPI, days around it <span className="font-normal">({flag.cultivation}, {columnName(flag)} in {unit})</span>
        </h4>
        <ul className="num flex gap-1 overflow-x-auto pb-1" aria-label="Same KPI, days around it">
          {days.map((d) => {
            const flagged = d.date === flag.date
            const value = field === 'actual' ? d.actual : d.target
            return (
              <li key={d.row} className={`flex w-[4.75rem] shrink-0 flex-col rounded-lg border border-line-soft px-1.5 py-1 text-xs ${flagged ? HIGHLIGHT : 'bg-card'}`}>
                <span>{formatDate(d.date).replace(/ \d{4}$/, '')}</span>
                <span className="text-ink-2">{displayCellRef(letter, d.row)}</span>
                <span className="font-semibold">{value === null ? <span className="font-normal text-ink-3">(empty)</span> : value}</span>
                {flagged && <span className="sr-only">flagged</span>}
              </li>
            )
          })}
        </ul>
      </div>
      <p className="text-xs text-ink-2">Values as in the workbook, not as edited or corrected in the app.</p>
    </div>
  )
}
