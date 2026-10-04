import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { WeekInfo } from '../data/types'
import { useCropData } from './CropDataContext'

/** What the person is looking at: one week for the whole app, plus the Scorecard's filters. */
interface View {
  week: string
  weekInfo: WeekInfo
  setWeek: (week: string) => void
  facility: string
  setFacility: (facility: string) => void
  variety: string
  setVariety: (variety: string) => void
}

export const ALL = 'All'

const Ctx = createContext<View | null>(null)

export function useView(): View {
  const value = useContext(Ctx)
  if (!value) throw new Error('useView must be used inside ViewProvider')
  return value
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const { weeks } = useCropData()
  // The latest week in the data (W34, 18-24 Aug 2025) is the default.
  const [chosen, setWeek] = useState(() => weeks[weeks.length - 1]!.id)
  // If the chosen week is no longer in the data (a change from someone else), fall back to the latest.
  const week = weeks.some((w) => w.id === chosen) ? chosen : weeks[weeks.length - 1]!.id
  const [facility, setFacility] = useState(ALL)
  const [variety, setVariety] = useState(ALL)
  const value = useMemo<View>(
    () => ({ week, weekInfo: weeks.find((w) => w.id === week)!, setWeek, facility, setFacility, variety, setVariety }),
    [week, weeks, facility, variety],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
