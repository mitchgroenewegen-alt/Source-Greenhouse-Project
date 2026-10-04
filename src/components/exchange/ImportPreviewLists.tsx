import { hasKpiConfig, kpiConfig, planWord } from '../../config/kpis'
import { formatDate } from '../../data/dates'
import type { FlaggedExample, PreviewRow } from '../../exchange/preview'
import type { ImportProblem } from '../../exchange/parse'
import { formatValue } from '../../lib/kpiFormat'

/** How many lines of each list are shown; the rest are counted. */
export const LISTED = 10

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-line-soft bg-tile p-3">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-ink-2">({count})</span>
      </h3>
      {children}
    </section>
  )
}

const more = (total: number, shown: number) => (total > shown ? <p className="text-xs text-ink-2">and {total - shown} more.</p> : null)

/** "actual 0.50 → 0.70, budget 0.63" for a day the file changes or adds. */
function valuesText({ row, before, after }: PreviewRow): string {
  const config = hasKpiConfig(row.kpi) ? kpiConfig(row.kpi) : null
  const show = (v: number | null) => (config ? formatValue(config, v) : String(v ?? '–'))
  const part = (label: string, was: number | null | undefined, now: number | null) =>
    before && was !== now ? `${label} ${show(was ?? null)} → ${show(now)}` : now !== null ? `${label} ${show(now)}` : null
  const text = [part('actual', before?.actual, after.actual), part(config ? planWord(config) : 'target', before?.target, after.target)].filter(Boolean).join(', ')
  return `${text}${config ? ` ${config.unit}` : ''}`
}

function RowList({ rows }: { rows: PreviewRow[] }) {
  return (
    <>
      <ul className="num flex flex-col gap-1 text-sm">
        {rows.slice(0, LISTED).map((r) => (
          <li key={r.row.line} className="break-words">
            <span className="font-semibold">{r.row.cultivation}</span> · {r.row.kpi} · {formatDate(r.row.date)}: {valuesText(r)}
          </li>
        ))}
      </ul>
      {more(rows.length, LISTED)}
    </>
  )
}

export function NewRowList({ rows }: { rows: PreviewRow[] }) {
  return (
    <Section title="New days" count={rows.length}>
      <RowList rows={rows} />
    </Section>
  )
}

export function ChangedRowList({ rows }: { rows: PreviewRow[] }) {
  return (
    <Section title="Changed values" count={rows.length}>
      <RowList rows={rows} />
    </Section>
  )
}

export function ProblemList({ problems }: { problems: ImportProblem[] }) {
  return (
    <Section title="Problems, left out of the import" count={problems.length}>
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
        {problems.slice(0, 50).map((p) => (
          <li key={p.line} className="break-words">
            {p.message}
          </li>
        ))}
      </ul>
      {more(problems.length, 50)}
    </Section>
  )
}

export function FlaggedNote({ flagged, examples }: { flagged: number; examples: FlaggedExample[] }) {
  if (flagged === 0) return null
  return (
    <section role="status" className="flex flex-col gap-1.5 rounded-xl border border-flag bg-flag-bg p-3 text-sm text-flag-ink">
      <h3 className="font-semibold">
        {flagged} {flagged === 1 ? 'value' : 'values'} would be flagged by the data checks
      </h3>
      <p>They are still imported. Until someone decides on them in Data checks, flagged values are left out of the scores.</p>
      <ul className="num flex flex-col gap-1">
        {examples.map((e, i) => (
          <li key={i} className="break-words">
            {e.cultivation} · {e.kpi} · {formatDate(e.date)}: {e.explanation}
          </li>
        ))}
      </ul>
      {more(flagged, examples.length)}
    </section>
  )
}
