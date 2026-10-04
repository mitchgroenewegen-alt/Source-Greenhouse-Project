import { useMemo, useState } from 'react'
import type { Cultivation } from '../../data/types'
import { precheckValues, type Concern, type ValueChange } from '../../editing/precheck'
import { dayLookup, toEnteredRows, type EntryValue } from '../../entry/entries'
import { useCropData } from '../../state/CropDataContext'
import { merge } from '../../workspace/merge'
import { useWorkspace } from '../../workspace/WorkspaceContext'

/** What the data checks said about values in waiting. */
interface Pending {
  values: EntryValue[]
  concerns: Concern[]
  suggested: EntryValue[] | null
}

const toChange = (v: EntryValue): ValueChange => ({ date: v.date, actual: v.actual, target: v.target })

/** The values with each KPI's suggestions in place of what was typed; null when no KPI has one. */
function checkValues(values: EntryValue[], cultivation: Cultivation, daily: Parameters<typeof precheckValues>[0]): Pending {
  const kpis = [...new Set(values.map((v) => v.kpi))]
  const concerns: Concern[] = []
  const suggestions = new Map<string, ValueChange>()
  for (const kpi of kpis) {
    const result = precheckValues(daily, cultivation, kpi, values.filter((v) => v.kpi === kpi).map(toChange))
    // With several KPIs the title says which one it is about.
    concerns.push(...result.concerns.map((c) => (kpis.length > 1 ? { ...c, title: `${kpi}: ${c.title}` } : c)))
    for (const s of result.suggested ?? []) suggestions.set(`${kpi}|${s.date}`, s)
  }
  const suggested =
    suggestions.size === 0
      ? null
      : values.map((v) => {
          const s = suggestions.get(`${v.kpi}|${v.date}`)
          return s ? { ...v, actual: s.actual, target: s.target } : v
        })
  return { values, concerns, suggested }
}

/**
 * Saving typed values: the data checks look at them first (the same ones the budget editor uses), and when something
 * looks odd the person chooses Use suggestion, Save anyway or Cancel. Saved values are EnteredRows with source 'entered'.
 */
export function useEntryFlow(cultivation: Cultivation | undefined, createdBy: string) {
  const { data, workbook } = useCropData()
  const workspace = useWorkspace()
  const [pending, setPending] = useState<Pending | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  // The days without value edits, so a day's other column is carried over as the day had it (see toEnteredRows).
  const before = useMemo(() => dayLookup(merge(workbook, { ...workspace.data, valueEdits: [] }).daily), [workbook, workspace.data])

  async function save(values: EntryValue[]): Promise<boolean> {
    setSaving(true)
    const rows = toEnteredRows(values, before, { createdBy, createdAt: new Date().toISOString(), source: 'entered' })
    const ok = await workspace.save('enteredRows', rows)
    setSaving(false)
    setPending(null)
    setFailed(!ok)
    setSaved(ok ? `Saved ${rows.length} ${rows.length === 1 ? 'value' : 'values'} for ${rows[0]!.cultivation}.` : null)
    return ok
  }

  return {
    pending,
    saving,
    failed,
    saved,
    saveError: workspace.saveError,
    /** Anything typed after a warning or a "Saved" makes it out of date. */
    reset: () => {
      setPending(null)
      setFailed(false)
      setSaved(null)
    },
    /** Check, then save, or hold the values back with what was found. Resolves to true when they were saved. */
    async submit(values: EntryValue[]): Promise<boolean> {
      if (!cultivation) return false
      const result = checkValues(values, cultivation, data.daily)
      if (result.concerns.length > 0) {
        setPending(result)
        return false
      }
      return save(values)
    },
    async useSuggestion(): Promise<boolean> {
      if (!pending?.suggested || !cultivation) return false
      const result = checkValues(pending.suggested, cultivation, data.daily)
      if (result.concerns.length > 0) {
        setPending(result)
        return false
      }
      return save(pending.suggested)
    },
    saveAnyway: () => (pending ? save(pending.values) : Promise.resolve(false)),
    cancel: () => setPending(null),
  }
}

export type EntryFlow = ReturnType<typeof useEntryFlow>
