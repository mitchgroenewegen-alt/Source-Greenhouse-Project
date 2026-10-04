import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCropData } from '../../state/CropDataContext'
import { BarsIcon, GridIcon, InfoIcon, ShieldIcon } from '../ui/icons'
import { RawDataToggle } from './RawDataToggle'
import { WeekPicker } from './WeekPicker'

const NAV = [
  { to: '/', label: 'Scorecard', icon: GridIcon, match: (p: string) => p === '/' || p.startsWith('/cultivation') },
  { to: '/facilities', label: 'Facilities', icon: BarsIcon, match: (p: string) => p.startsWith('/facilities') },
  { to: '/checks', label: 'Data checks', icon: ShieldIcon, match: (p: string) => p.startsWith('/checks') },
  { to: '/about', label: 'About', icon: InfoIcon, match: (p: string) => p.startsWith('/about') },
]

function useNavItems() {
  const { pathname } = useLocation()
  const { openReviewGroups } = useCropData()
  const open = openReviewGroups().length
  return NAV.map((item) => ({ ...item, active: item.match(pathname), badge: item.to === '/checks' && open > 0 ? open : null }))
}

export function AppShell({ children }: { children: ReactNode }) {
  const items = useNavItems()
  const { rawMode } = useCropData()
  return (
    <div className="min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header id="app-header" className="z-30 border-b border-line bg-card md:sticky md:top-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-brand">
            <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={28} height={28} className="rounded-md" />
            Crop Performance
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={item.active ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold ${
                  item.active ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-tile'
                }`}
              >
                <item.icon width={18} height={18} />
                {item.label}
                {item.badge !== null && <span className="rounded-full bg-bad px-1.5 text-xs text-white">{item.badge}</span>}
              </Link>
            ))}
          </nav>
          <div className="flex w-full items-center justify-between gap-2 md:ml-auto md:w-auto md:justify-end">
            <WeekPicker />
            <RawDataToggle />
          </div>
        </div>
        {rawMode && (
          <p role="status" className="border-t border-warn-line bg-warn-bg px-4 py-1.5 text-center text-sm text-warn-ink">
            Raw data is on: flagged values count towards the scores exactly as recorded.
          </p>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 md:py-6">{children}</main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={item.active ? 'page' : undefined}
            className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
              item.active ? 'text-brand' : 'text-ink-3'
            }`}
          >
            <item.icon width={22} height={22} />
            {item.label}
            {item.badge !== null && (
              <span className="absolute right-[22%] top-1.5 min-w-5 rounded-full bg-bad px-1 text-center text-[0.7rem] leading-5 text-white">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  )
}
