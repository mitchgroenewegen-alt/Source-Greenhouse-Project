import { useMemo, useRef, useState } from 'react'
import { formatDate, formatRange } from '../../data/dates'
import { formatDateTime } from '../../lib/format'
import { fieldWord } from '../../flags'
import { decisionOutcome, decisionsToCsv, mergeDecisions, parseDecisionsCsv, type Decision } from '../../storage'

interface Entry {
  key: string
  decisions: Decision[]
}

/** Decisions made together (same cell group, kind, person, time) read as one line. */
function toEntries(decisions: Decision[]): Entry[] {
  const map = new Map<string, Decision[]>()
  for (const d of decisions) {
    const key = [d.cultivation, d.kpi, d.field, d.kind, d.decidedBy, d.decidedAt].join('|')
    const list = map.get(key)
    if (list) list.push(d)
    else map.set(key, [d])
  }
  return [...map.entries()]
    .map(([key, list]) => ({ key, decisions: list.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.decisions[0]!.decidedAt.localeCompare(a.decisions[0]!.decidedAt))
}

function download(text: string, filename: string) {
  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function DecisionLog({
  decisions,
  onReopen,
  onReplace,
}: {
  decisions: Decision[]
  onReopen: (cellIds: string[]) => void
  onReplace: (decisions: Decision[]) => void
}) {
  const entries = useMemo(() => toEntries(decisions), [decisions])
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string; details?: string[] } | null>(null)

  async function importFile(file: File) {
    const text = await file.text()
    const { decisions: imported, errors } = parseDecisionsCsv(text)
    if (imported.length === 0) {
      setMessage({ tone: 'bad', text: `Nothing was imported from ${file.name}.`, details: errors.slice(0, 5) })
      return
    }
    const result = mergeDecisions(decisions, imported)
    onReplace(result.merged)
    setMessage({
      tone: errors.length ? 'bad' : 'ok',
      text: `Imported ${imported.length} decisions from ${file.name}: ${result.added} new, ${result.updated} updated${result.keptExisting ? `, ${result.keptExisting} older than the ones already here (kept the newer)` : ''}.${errors.length ? ` ${errors.length} rows were skipped.` : ''}`,
      details: errors.slice(0, 5),
    })
  }

  return (
    <section aria-labelledby="log-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="log-title" className="text-lg font-semibold">
            Decision log
          </h2>
          <p className="text-sm">{entries.length === 0 ? 'No decisions yet.' : `${decisions.length} values decided, in ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}. Newest first.`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={decisions.length === 0}
            onClick={() => download(decisionsToCsv(decisions), `crop-performance-decisions-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="min-h-10 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Export CSV
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className="min-h-10 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink">
            Import CSV
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Import decisions from a CSV file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {message && (
        <div role="status" className={`rounded-2xl border p-3 text-sm ${message.tone === 'ok' ? 'border-ok-line bg-ok-bg text-ok-ink' : 'border-bad-line bg-bad-bg text-bad-ink'}`}>
          <p>{message.text}</p>
          {message.details && message.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {message.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 shadow-sm">
          {entries.map(({ key, decisions: list }) => {
            const first = list[0]!
            const last = list[list.length - 1]!
            return (
              <li key={key} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-line-soft bg-tile p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {first.cultivation} · {first.kpi} · {fieldWord(first.field, first.kpi)}
                  </p>
                  <p>
                    {decisionOutcome(list)}
                    {' · '}
                    {list.length === 1 ? formatDate(first.date) : `${list.length} values, ${formatRange(first.date, last.date)}`}
                  </p>
                  <p className="text-ink-2">
                    {formatDateTime(first.decidedAt)}
                    {first.note ? ` · “${first.note}”` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => onReopen(list.map((d) => d.cellId))} className="min-h-9 rounded-lg border border-line-strong bg-field px-3 text-sm font-semibold text-ink">
                  Reopen
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
