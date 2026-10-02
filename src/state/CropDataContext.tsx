import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Cultivation, DataFile, WeekInfo } from '../data/types'
import { detectFlags, groupFlags, type Flag, type FlagGroup } from '../flags'
import { applyDecisions, buildWeekly, weeklyKey, type WeeklyLookup, type WeeklyPoint } from '../scoring/effective'
import { scoreCultivationWeek, type CultivationScore } from '../scoring/summary'
import { createDecisionStore, readPreference, writePreference, type Decision, type DecisionStore } from '../storage'
import { groupStatus, needsReview, type GroupStatus } from './groupStatus'

export interface CropData {
  data: DataFile
  weeks: WeekInfo[]
  cultivations: Cultivation[]
  cultivationById: (id: string) => Cultivation | undefined
  flags: Flag[]
  groups: FlagGroup[]
  decisions: Decision[]
  decisionById: ReadonlyMap<string, Decision>
  statusOf: (group: FlagGroup) => GroupStatus
  /** Groups still waiting for a decision that hold a number back (missing values not included). */
  openReviewGroups: (cultivation?: string) => FlagGroup[]
  /** True when the browser keeps decisions between visits. */
  persistent: boolean
  rawMode: boolean
  setRawMode: (raw: boolean) => void
  decidedBy: string
  setDecidedBy: (name: string) => void
  point: (cultivation: string, kpi: string, week: string) => WeeklyPoint | undefined
  scoreOf: (cultivation: string, week: string) => CultivationScore
  saveDecisions: (decisions: Decision[]) => void
  removeDecisions: (cellIds: string[]) => void
  replaceDecisions: (decisions: Decision[]) => void
}

const Ctx = createContext<CropData | null>(null)

export function useCropData(): CropData {
  const value = useContext(Ctx)
  if (!value) throw new Error('useCropData must be used inside CropDataProvider')
  return value
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: DataFile }

function useDataFile(): [Load, () => void] {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoad({ state: 'loading' })
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`data.json answered ${response.status}`)
        return response.json() as Promise<DataFile>
      })
      .then((data) => !cancelled && setLoad({ state: 'ready', data }))
      .catch((error: unknown) => !cancelled && setLoad({ state: 'error', message: error instanceof Error ? error.message : String(error) }))
    return () => {
      cancelled = true
    }
  }, [attempt])
  return [load, () => setAttempt((n) => n + 1)]
}

export function CropDataProvider({ children }: { children: ReactNode }) {
  const [load, retry] = useDataFile()
  if (load.state === 'loading') return <FullPageMessage title="Loading crop data" detail="One moment." />
  if (load.state === 'error') {
    return (
      <FullPageMessage title="The data could not be loaded" detail={load.message}>
        <button type="button" onClick={retry} className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
          Try again
        </button>
      </FullPageMessage>
    )
  }
  return <ReadyProvider data={load.data}>{children}</ReadyProvider>
}

function FullPageMessage({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return (
    <div role="status" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-ink-2">{detail}</p>
      {children}
    </div>
  )
}

function ReadyProvider({ data, children }: { data: DataFile; children: ReactNode }) {
  // Flags depend only on the workbook, so they are worked out once.
  const flags = useMemo(() => detectFlags(data.daily, data.cultivations), [data])
  const groups = useMemo(() => groupFlags(flags, data.daily), [flags, data])

  const [store] = useState<DecisionStore>(() => createDecisionStore())
  const decisions = useSyncExternalStore((listener) => store.subscribe(listener), () => store.getAll())
  const decisionById = useMemo(() => new Map(decisions.map((d) => [d.cellId, d])), [decisions])

  const [rawMode, setRawModeState] = useState(() => readPreference('rawMode', false))
  const setRawMode = useCallback((raw: boolean) => {
    setRawModeState(raw)
    writePreference('rawMode', raw)
  }, [])
  const [decidedBy, setDecidedByState] = useState(() => readPreference('decidedBy', ''))
  const setDecidedBy = useCallback((name: string) => {
    setDecidedByState(name)
    writePreference('decidedBy', name)
  }, [])

  // What actually goes into the scores: flagged values left out until decided, or the raw values.
  const weekly: WeeklyLookup = useMemo(
    () => buildWeekly(applyDecisions(data.daily, flags, decisions, rawMode)),
    [data, flags, decisions, rawMode],
  )

  const value = useMemo<CropData>(() => {
    const cultivationMap = new Map(data.cultivations.map((c) => [c.id, c]))
    const scoreCache = new Map<string, CultivationScore>()
    return {
      data,
      weeks: data.weeks,
      cultivations: data.cultivations,
      cultivationById: (id) => cultivationMap.get(id),
      flags,
      groups,
      decisions,
      decisionById,
      statusOf: (group) => groupStatus(group, decisionById),
      openReviewGroups: (cultivation) =>
        groups.filter(
          (g) => needsReview(g) && (!cultivation || g.cultivation === cultivation) && groupStatus(g, decisionById) !== 'decided',
        ),
      persistent: store.persistent,
      rawMode,
      setRawMode,
      decidedBy,
      setDecidedBy,
      point: (cultivation, kpi, week) => weekly.get(weeklyKey(cultivation, kpi, week)),
      scoreOf: (cultivation, week) => {
        const key = `${cultivation}|${week}`
        let score = scoreCache.get(key)
        if (!score) {
          score = scoreCultivationWeek(weekly, cultivation, week)
          scoreCache.set(key, score)
        }
        return score
      },
      saveDecisions: (next) => store.save(next),
      removeDecisions: (ids) => store.remove(ids),
      replaceDecisions: (next) => store.replaceAll(next),
    }
  }, [data, flags, groups, decisions, decisionById, store, rawMode, setRawMode, decidedBy, setDecidedBy, weekly])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
