import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fixed } from '../../lib/format'
import { signedPercent } from '../../lib/format'
import { StatusBadge } from '../ui/StatusBadge'
import { facilityTotal, toTonnes, type HarvestRow, type Period } from './facilityTotals'

export type Unit = 'kgm2' | 'tonnes'

const BUDGET_COLOR = '#8b9791'
const ACTUAL_COLOR = 'var(--color-actual)'

interface Bars {
  name: string
  budget: number | null
  actual: number | null
}

function barsFor(rows: HarvestRow[], period: Period, unit: Unit): Bars[] {
  const total = facilityTotal(rows, period)
  const convert = (kg: number | null, area: number) => (kg === null ? null : unit === 'tonnes' ? toTonnes(kg, area) : kg)
  return [
    ...rows.map((r) => ({
      name: r.cultivation.id.split('-').slice(1).join('-'), // the facility is already the card's title
      budget: convert(r.budget, r.cultivation.areaM2),
      actual: convert(r.actual, r.cultivation.areaM2),
    })),
    { name: 'Total', budget: convert(total.budget, total.areaM2), actual: convert(total.actual, total.areaM2) },
  ]
}

export function FacilityCard({ facility, rows, period, unit }: { facility: string; rows: HarvestRow[]; period: Period; unit: Unit }) {
  const total = facilityTotal(rows, period)
  const decimals = unit === 'tonnes' ? 1 : 2
  const unitLabel = unit === 'tonnes' ? 't' : 'kg/m²'
  const bars = barsFor(rows, period, unit)
  const show = (kg: number | null, area: number) => (kg === null ? '–' : fixed(unit === 'tonnes' ? toTonnes(kg, area) : kg, decimals))

  return (
    <section aria-labelledby={`fac-${facility}`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`fac-${facility}`} className="text-lg font-semibold">
            {facility}
          </h2>
          <p className="num text-sm text-ink-2">
            {rows.length} {rows.length === 1 ? 'cultivation' : 'cultivations'} · {fixed(rows.reduce((s, r) => s + r.cultivation.areaM2, 0), 0)} m²
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={total.status} />
          <p className="num mt-1 text-sm text-ink-2">
            {total.variance === null ? 'No total' : `${signedPercent(total.variance)} against budget`}
          </p>
        </div>
      </header>

      <div role="img" aria-label={`Bar chart of budget and actual harvest in ${unitLabel} for ${rows.map((r) => r.cultivation.id).join(', ')} and the facility total. The table below has the numbers.`} style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 18, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-ink-2)' }} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} interval={0} />
            <YAxis width={44} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value, name) => [`${fixed(Number(value), decimals)} ${unitLabel}`, name === 'budget' ? 'Budget' : 'Actual']}
              cursor={{ fill: 'var(--color-line-soft)' }}
            />
            <Bar dataKey="budget" name="budget" fill={BUDGET_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="budget" position="top" fontSize={10} fill="var(--color-ink-3)" formatter={(v) => (v == null ? '' : fixed(Number(v), decimals))} />
            </Bar>
            <Bar dataKey="actual" name="actual" fill={ACTUAL_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="actual" position="top" fontSize={10} fill="var(--color-ink)" formatter={(v) => (v == null ? '' : fixed(Number(v), decimals))} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chart key">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: BUDGET_COLOR }} aria-hidden="true" /> Budget
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ACTUAL_COLOR }} aria-hidden="true" /> Actual
        </li>
      </ul>

      <table className="num w-full text-sm">
        <caption className="sr-only">
          {facility}: harvest against budget in {unitLabel}
        </caption>
        <thead>
          <tr className="border-b border-line text-xs text-ink-2">
            <th scope="col" className="py-1.5 pr-2 text-left font-semibold">Cultivation</th>
            <th scope="col" className="hidden px-1 py-1.5 text-right font-semibold sm:table-cell">m²</th>
            <th scope="col" className="px-1 py-1.5 text-right font-semibold">Budget {unitLabel}</th>
            <th scope="col" className="px-1 py-1.5 text-right font-semibold">Actual {unitLabel}</th>
            <th scope="col" className="py-1.5 pl-1 text-right font-semibold">vs budget</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cultivation.id} className="border-b border-line-soft align-top">
              <th scope="row" className="py-2 pr-2 text-left text-xs font-semibold sm:text-sm">
                {r.cultivation.id}
                <span className="block text-xs font-normal text-ink-3 sm:hidden">{fixed(r.cultivation.areaM2, 0)} m²</span>
              </th>
              <td className="hidden px-1 py-2 text-right text-ink-2 sm:table-cell">{fixed(r.cultivation.areaM2, 0)}</td>
              <td className="px-1 py-2 text-right">{show(r.budget, r.cultivation.areaM2)}</td>
              <td className="px-1 py-2 text-right font-semibold">{show(r.actual, r.cultivation.areaM2)}</td>
              <td className="py-2 pl-1 text-right">
                <div className="font-semibold">{r.variance === null ? '–' : signedPercent(r.variance)}</div>
                <StatusBadge status={r.status} className="mt-0.5" />
              </td>
            </tr>
          ))}
          <tr className="bg-page/70 align-top font-semibold">
            <th scope="row" className="py-2 pr-2 text-left text-xs sm:text-sm">
              Facility total{unit === 'kgm2' ? ' (area-weighted)' : ''}
              <span className="block text-xs font-normal text-ink-3 sm:hidden">{fixed(total.areaM2, 0)} m²</span>
            </th>
            <td className="hidden px-1 py-2 text-right text-ink-2 sm:table-cell">{fixed(total.areaM2, 0)}</td>
            <td className="px-1 py-2 text-right">{show(total.budget, total.areaM2)}</td>
            <td className="px-1 py-2 text-right">{show(total.actual, total.areaM2)}</td>
            <td className="py-2 pl-1 text-right">
              <div>{total.variance === null ? '–' : signedPercent(total.variance)}</div>
              <StatusBadge status={total.status} className="mt-0.5" />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}
