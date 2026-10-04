import type { ReactNode } from 'react'

/** A card of the Climate tab: a title, one line under it, the content. Charts inside sit on a tile, one step paler than the card. */
export function ClimateCard({ title, note, children, headingLevel = 3 }: { title: string; note?: ReactNode; children: ReactNode; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <header>
        <Heading className="text-base font-semibold leading-tight">{title}</Heading>
        {note && <p className="text-xs text-ink-3">{note}</p>}
      </header>
      {children}
    </article>
  )
}

/** The plot's tile with its accessible description. */
export function PlotTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className="rounded-xl border border-line-soft bg-tile py-1.5 pr-1">
      {children}
    </div>
  )
}

export function EmptyPlot({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-line-soft bg-tile p-4 text-center text-sm text-ink-2">{children}</p>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-2 text-xl font-semibold">{children}</h2>
}
