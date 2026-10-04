import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Cultivation, DataFile, WeekInfo } from '../data/types'
import { detectFlags, groupFlags, type Flag, type FlagGroup } from '../flags'
import { applyDecisions, buildWeekly, weeklyKey, type WeeklyLookup, type WeeklyPoint } from '../scoring/effective'
import { scoreCultivationWeek, type CultivationScore } from '../scoring/summary'
import { readPreference, writePreference, type Decision } from '../storage'
import { correctionEdit, correctionEditId } from '../workspace/corrections'
import { merge } from '../workspace/merge'
import { useWorkspace } from '../workspace/WorkspaceContext'
import type { WorkspaceStatus } from '../workspace/types'
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
  /** Who decides: the signed-in email, or the name typed in when there is no sign-in. */
  decidedBy: string
  setDecidedBy: (name: string) => void
  /** Email of the signed-in person, null when nobody is. Their name is then not typed in. */
  signedInAs: string | null
  workspaceStatus: WorkspaceStatus
  /** False when signed out or when the shared database cannot be reached: decisions cannot be saved. */
  canWrite: boolean
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
  const { ready } = useWorkspace()
  if (load.state === 'loading' || !ready) return <FullPageMessage title="Loading crop data" detail="One moment." />
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
      <p>{detail}</p>
      {children}
    </div>
  )
}

function ReadyProvider({ data: base, children }: { data: DataFile; children: ReactNode }) {
  const workspace = useWorkspace()
  const { save, remove, user, status, canWrite } = workspace
  const decisions = workspace.data.decisions

  // Every screen uses the workbook with the workspace laid over it (added days, edits, new cultivations).
  const data = useMemo(() => merge(base, workspace.data), [base, workspace.data])
  // The data checks and the scores start from the values as recorded: "Apply correction" is applied through its
  // decision, so the value edit it also leaves behind is not counted twice.
  const checked = useMemo(() => merge(base, workspace.data, { skipCorrected: true }), [base, workspace.data])

  const flags = useMemo(() => detectFlags(checked.daily, checked.cultivations), [checked])
  const groups = useMemo(() => groupFlags(flags, checked.daily), [flags, checked])
  const decisionById = useMemo(() => new Map(decisions.map((d) => [d.cellId, d])), [decisions])

  const [rawMode, setRawModeState] = useState(() => readPreference('rawMode', false))
  const setRawMode = useCallback((raw: boolean) => {
    setRawModeState(raw)
    writePreference('rawMode', raw)
  }, [])
  const [typedName, setTypedName] = useState(() => readPreference('decidedBy', ''))
  const setDecidedBy = useCallback(
    (name: string) => {
      if (user) return // signed in: the name comes from the account
      setTypedName(name)
      writePreference('decidedBy', name)
    },
    [user],
  )
  const decidedBy = user ?? typedName

  // What actually goes into the scores: flagged values left out until decided, or the raw values.
  const weekly: WeeklyLookup = useMemo(
    () => buildWeekly(applyDecisions(checked.daily, flags, decisions, rawMode)),
    [checked, flags, decisions, rawMode],
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
      persistent: workspace.persistent,
      rawMode,
      setRawMode,
      decidedBy,
      setDecidedBy,
      signedInAs: user,
      workspaceStatus: status,
      canWrite,
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
      saveDecisions: (next) => {
        void save('decisions', next)
        // "Apply correction" also writes a value edit; a cell decided another way loses the one it had.
        const corrected = next.filter((d) => d.kind === 'correct')
        if (corrected.length > 0) void save('valueEdits', corrected.map(correctionEdit))
        const others = next.filter((d) => d.kind !== 'correct')
        if (others.length > 0) void remove('valueEdits', others.map((d) => correctionEditId(d.cellId)))
      },
      removeDecisions: (ids) => {
        void remove('decisions', ids)
        void remove('valueEdits', ids.map(correctionEditId))
      },
      replaceDecisions: (next) => {
        const keep = new Set(next.map((d) => d.cellId))
        const gone = decisions.filter((d) => !keep.has(d.cellId)).map((d) => d.cellId)
        if (gone.length > 0) {
          void remove('decisions', gone)
          void remove('valueEdits', gone.map(correctionEditId))
        }
        void save('decisions', next)
        const corrected = next.filter((d) => d.kind === 'correct')
        if (corrected.length > 0) void save('valueEdits', corrected.map(correctionEdit))
        const others = next.filter((d) => d.kind !== 'correct')
        if (others.length > 0) void remove('valueEdits', others.map((d) => correctionEditId(d.cellId)))
      },
    }
  }, [data, flags, groups, decisions, decisionById, workspace.persistent, rawMode, setRawMode, decidedBy, setDecidedBy, user, status, canWrite, save, remove, weekly])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
