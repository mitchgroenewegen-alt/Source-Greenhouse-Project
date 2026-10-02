import type { ReactNode } from 'react'
import { CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_ROLLUP, kpisInCategory } from '../config/kpis'
import { formatDate } from '../data/dates'
import { FLAG_THRESHOLDS as T } from '../flags'
import { directionText, toleranceText } from '../lib/kpiFormat'
import { useCropData } from '../state/CropDataContext'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  )
}

/** A share as a phrase: 1/3 reads "one third", 2/3 "two thirds", anything else as a percentage. */
function shareWords(share: number): string {
  const near = (x: number) => Math.abs(share - x) < 1e-6
  if (near(1 / 2)) return 'half'
  if (near(1 / 3)) return 'one third'
  if (near(2 / 3)) return 'two thirds'
  if (near(1 / 4)) return 'a quarter'
  if (near(3 / 4)) return 'three quarters'
  return `${Math.round(share * 100)}%`
}

const AGGREGATION_WORD = { sum: 'Sum', average: 'Average', last: 'Last value' } as const

export default function AboutScreen() {
  const { data } = useCropData()
  const { meta } = data
  const first = data.weeks[0]!
  const last = data.weeks[data.weeks.length - 1]!

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">About this tool</h1>
        <p className="text-ink-2">
          Crop Performance shows how each of the {meta.cultivationCount} tomato cultivations is doing against budget, and which inputs a person should check before trusting a number.
        </p>
      </div>

      <Section title="Data period">
        <p>
          {formatDate(meta.periodStart)} to {formatDate(meta.periodEnd)}: {meta.dayCount} days, {meta.weekCount} ISO weeks ({first.id} to {last.id}). The latest full week is {last.id.split('-')[1]} ({formatDate(last.start)} to {formatDate(last.end)}), which is the default.
        </p>
        <p>
          Source: <code>{meta.source}</code> (sheets Read me, Greenhouses, KPIs): {meta.cultivationCount} cultivations in 7 greenhouses at 3 facilities, {meta.kpiCount} KPIs in 5 categories. Everything is read from that one file and nothing is sent anywhere.
        </p>
      </Section>

      <Section title="How a KPI is scored">
        <ol className="list-decimal pl-5">
          <li>
            Each KPI is added up over the week with the rule from the workbook’s KPI dictionary: <strong>sum</strong> (e.g. harvest), <strong>average</strong> (e.g. temperature) or <strong>last value</strong> (cumulative harvest, and waste, which is the last value of the week). The budget is added up with the same rule, using only days that have both an actual and a budget.
          </li>
          <li>
            The variance is the actual compared with the budget, in percent of the budget or, for temperatures, index KPIs and waste, in the KPI’s own unit (waste in percentage points, so 1.5 % against a 1.0 % budget is +0.5 points).
          </li>
          <li>
            The variance is compared with the green and amber tolerances for that KPI. Beyond amber it is red. A KPI with no budget for the week is shown but not scored.
          </li>
          <li>
            A category (Production, Plant, Climate, Irrigation, Resources) is rated from the share of its scored KPIs that are red or green: <strong>Off track</strong> when at least {shareWords(CATEGORY_ROLLUP.redShare)} of them are red, <strong>On track</strong> when at least {shareWords(CATEGORY_ROLLUP.greenShare)} are green (and fewer than {shareWords(CATEGORY_ROLLUP.redShare)} are red), otherwise <strong>Watch</strong>. A KPI without a score that week is not counted. The badge line still names the worst KPI, and how many are red, amber and green.
          </li>
          <li>
            Cultivations are sorted worst first: most red categories, then most amber ones, then the shortfall on cumulative harvest.
          </li>
        </ol>
        <p className="text-ink-2">
          Status always comes with words (On track, Watch, Off track, Not scored) and an icon, never colour alone. All thresholds come from <code>src/config/kpis.ts</code>; the tables below are generated from that file.
        </p>
      </Section>

      {CATEGORY_ORDER.map((category) => (
        <section key={category} className="rounded-2xl border border-line bg-card shadow-sm" aria-labelledby={`about-${category}`}>
          <h2 id={`about-${category}`} className="px-4 pt-3 text-base font-semibold">
            Scoring rules: {CATEGORY_LABEL[category]}
          </h2>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${CATEGORY_LABEL[category]} scoring rules, scrolls sideways`}>
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-2">
                  <th scope="col" className="px-4 py-2 font-semibold">KPI</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Per week</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Better when</th>
                  <th scope="col" className="px-2 py-2 font-semibold">On track</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Watch</th>
                </tr>
              </thead>
              <tbody>
                {kpisInCategory(category).map((k) => {
                  const t = toleranceText(k)
                  return (
                    <tr key={k.name} className="border-b border-line-soft align-top">
                      <th scope="row" className="px-4 py-1.5 text-left font-semibold">
                        {k.name} <span className="font-normal text-ink-3">({k.unit})</span>
                      </th>
                      <td className="px-2 py-1.5">{AGGREGATION_WORD[k.aggregation]}</td>
                      <td className="px-2 py-1.5">{directionText(k).replace(' is better', '').replace(' is best', '')}</td>
                      <td className="px-2 py-1.5">{t.green}</td>
                      <td className="px-4 py-1.5">{t.amber}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <Section title="What the data checks look for">
        <ul className="list-disc pl-5">
          <li><strong>Unit slips:</strong> a Fahrenheit reading entered as Celsius, a fraction (0.4) entered where a percent (40) belongs, or a value ten times too big or too small. Where the fix is clear, a corrected value is suggested.</li>
          <li><strong>Impossible values:</strong> humidity or any percentage above 100, negative amounts, drain pH outside {T.phRange[0]} to {T.phRange[1]}.</li>
          <li><strong>Jumps:</strong> a value more than {T.jumpHigh} times, or less than {T.jumpLow} times, the cultivation’s own median for that KPI.</li>
          <li><strong>Target and actual far apart:</strong> over a week, the budget is more than {T.apartFactor} times away from the actual.</li>
          <li><strong>Missing values:</strong> an empty cell. It is left out and never counted as zero.</li>
        </ul>
        <p>
          Ordinary zeros are not flagged (weekend harvest, no heating on a warm day, a young crop in its first {T.youngCropWeeks} weeks). KPIs that follow the weather, such as solar radiation, skip the jump check. One cell gets at most one flag, from the most specific rule. A flagged value is left out of the scores until a person confirms it, corrects it or excludes it; the decision, who made it and when are kept in the decision log, in this browser, and can be exported and imported as CSV. “Show raw data” scores everything as recorded.
        </p>
      </Section>

      <Section title="Assumptions">
        <ul className="list-disc pl-5">
          <li>Budget is the Target column of the workbook.</li>
          <li>The grain is the ISO week (Monday to Sunday). Week {last.id.split('-')[1]} is the latest full week.</li>
          <li>The dictionary’s aggregation rule applies to targets as well as actuals.</li>
          <li>The thresholds are starting values, not agreed standards. They are meant to be tuned in <code>src/config/kpis.ts</code>. The share that makes a category red or green is <code>CATEGORY_ROLLUP</code> in the same file. Even so, expect a fair number of red categories in some weeks, especially Irrigation in the latest weeks.</li>
          <li>An empty cell means “not recorded”. It is never treated as zero.</li>
          <li>Ontario’s two cultivations (Cherry and TOV) share a greenhouse but are scored separately, each with its own growing area.</li>
          <li>Units are metric. Tonnes are kg/m² × growing area ÷ 1000; facility totals in kg/m² are weighted by growing area.</li>
          <li>The workbook states that targets have not been checked. Some targets look like typing slips; the data checks flag them instead of silently fixing them.</li>
        </ul>
      </Section>

      <Section title="Left out on purpose">
        <ul className="list-disc pl-5">
          <li>Forecasting and what-if scenarios.</li>
          <li>Alerts and notifications.</li>
          <li>Logins and shared decisions between people (decisions live in one browser; export and import move them).</li>
          <li>Editing the plan or the workbook.</li>
          <li>Grower-level climate detail (hour by hour, per zone).</li>
          <li>Financials (revenue, cost, margin).</li>
          <li>A live data connection: the app reads one prepared file, refreshed at build time.</li>
        </ul>
      </Section>
    </div>
  )
}
