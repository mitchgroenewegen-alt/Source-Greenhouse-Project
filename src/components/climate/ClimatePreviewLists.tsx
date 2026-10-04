import { formatDate } from '../../data/dates'
import type { ClimateProblem, ClimatePreview, ReadingChange } from '../../climate/import'
import { fixed } from '../../lib/format'

/** How many lines of each list are shown; the rest are counted. */
const LISTED = 8

const stamp = (timestamp: string) => `${formatDate(timestamp.slice(0, 10))} ${timestamp.slice(11)}`
const show = (v: number | null) => (v === null ? '–' : fixed(v, 2))

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

function ChangeList({ rows }: { rows: ReadingChange[] }) {
  return (
    <>
      <ul className="num flex flex-col gap-1 text-sm">
        {rows.slice(0, LISTED).map(({ row, before }) => (
          <li key={row.line} className="break-words">
            <span className="font-semibold">{row.cultivation}</span> · {row.parameter} · {stamp(row.timestamp)}:{' '}
            {before ? `realised ${show(before.value)} → ${show(row.value)}, setpoint ${show(before.setpoint)} → ${show(row.setpoint)}` : `realised ${show(row.value)}, setpoint ${show(row.setpoint)}`}
          </li>
        ))}
      </ul>
      {more(rows.length, LISTED)}
    </>
  )
}

export function NewReadingList({ rows }: { rows: ReadingChange[] }) {
  return (
    <Section title="New readings" count={rows.length}>
      <ChangeList rows={rows} />
    </Section>
  )
}

export function ChangedReadingList({ rows }: { rows: ReadingChange[] }) {
  return (
    <Section title="Changed readings" count={rows.length}>
      <ChangeList rows={rows} />
    </Section>
  )
}

export function ClimateProblemList({ problems }: { problems: ClimateProblem[] }) {
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

/** What the file covers: per cultivation the readings, the days and the parameters. */
export function CoverageList({ coverage }: { coverage: ClimatePreview['coverage'] }) {
  return (
    <Section title="What the file covers" count={coverage.length}>
      <ul className="num flex flex-col gap-1 text-sm">
        {coverage.map((c) => (
          <li key={c.cultivation} className="break-words">
            <span className="font-semibold">{c.cultivation}</span>: {c.readings.toLocaleString('en-US')} readings, {c.firstDay === c.lastDay ? formatDate(c.firstDay) : `${formatDate(c.firstDay)} to ${formatDate(c.lastDay)}`}; {c.parameters.join(', ')}
          </li>
        ))}
      </ul>
    </Section>
  )
}
