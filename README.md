# Crop Performance

Crop performance vs budget for Perfect Produce greenhouses (Source.ag case).

A web app for the Chief Growing Officer and the Director of Growing. It shows how each of the 8 tomato cultivations (Pennsylvania, Arizona, Ontario) performs against budget, week by week, and it flags inputs that look wrong so a person can verify them before trusting a number.

- **Scorecard** (home): one card per cultivation, worst first. Cumulative harvest vs budget, the week's harvest, fruit weight and waste, a status per category (Production, Plant, Climate, Irrigation, Resources) that takes the colour of its worst KPI and names it, and the number of open data flags. Facility and variety filters, and a week picker (default W34, 18-24 Aug 2025).
- **Cultivation detail**: facility, greenhouse, variety, planting date, crop week and growing area; one tab per category; every KPI as actual vs budget over the 13 weeks with the tolerance band shaded and flagged points marked; a weekly table underneath.
- **Facilities**: harvest vs budget per cultivation grouped by facility, as kg/m² and as tonnes, with area-weighted facility totals.
- **Data checks**: the flagged inputs, grouped so a run of the same problem is one item, with Confirm / Correct / Exclude, a decision log, and CSV export and import.
- **About**: data period, how each KPI is scored (generated from the config), assumptions, and what was left out.

It is a static site: no backend, no login. It works on a phone (bottom navigation, no sideways page scroll at 375 px) and installs as a PWA.

## Run it

You need Node 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run typecheck  # TypeScript
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
```

`npm run dev` and `npm run build` first run `npm run prepare-data`, which reads `data/Perfect-Produce-Growing-Data.xlsx` and writes `public/data.json` (generated, not committed). To use new data, replace the workbook (same sheets and columns) and run the build again. The script stops with a clear message if the workbook is not as expected, for example a KPI that is missing from `src/config/kpis.ts`.

## Where things are

```
data/                      the workbook (the only input)
scripts/prepare-data.ts    xlsx -> public/data.json (cultivations, daily rows, weekly roll-ups)
src/config/kpis.ts         the KPI rulebook: every threshold and direction
src/scoring/               green/amber/red scoring, weekly values with decisions applied, category summary
src/flags/                 data-check rules (detect.ts), their tuning knobs (settings.ts), grouping (group.ts)
src/storage/               decisions behind one interface (localStorage), CSV export and import
src/state/                 data loading, the selected week and filters
src/screens/               one file per screen
src/components/            small components named after what they show
```

## Change a threshold or a KPI

Everything that decides a score is in **`src/config/kpis.ts`**, one line per KPI:

```ts
{ name: 'Harvest', category: 'Production', unit: 'kg/m²', aggregation: 'sum', ...higherIsBetter(), showOnScorecard: true, decimals: 2 },
```

- Change tolerances by passing numbers to the helper: `higherIsBetter(3, 8)` is green down to -3 % and amber down to -8 %; `lowerIsBetter(5, 15)`; `closeToTarget(5, 10)`; `closeToTargetAbsolute(1, 2)` for a tolerance in the KPI's own unit (used for temperatures and the two index KPIs).
- Change the direction of a KPI by swapping the helper on its line.
- `showOnScorecard` picks the headline numbers on each card. `decimals` is how values are shown.
- `aggregation` must match the workbook's KPI dictionary (sum, average or last value). The build fails if it does not.
- To add a KPI: add it to the workbook's KPI dictionary and add a line here. A KPI without a budget in the data is shown but not scored; nothing else needs to change.

The About screen's scoring tables are generated from this file, so they always match.

The data checks have their own knobs in `src/flags/settings.ts`: the ratios for a "jump" (2.5x and 0.4x), the "far apart" factor (2.5x), how many weeks a young crop is left alone, and per-KPI exceptions (for example Harvest is only flagged when too high, and weather-driven KPIs skip the jump check).

## Deploy to Vercel

1. Push the repository and import it in Vercel.
2. Framework preset **Vite**; leave the defaults (build command `npm run build`, output directory `dist`, install command `npm install`).
3. Deploy. No `vercel.json` is needed: the app uses hash routes (`/#/checks`), so every address is served by `index.html`.

The build reads the workbook from `data/` and generates `data.json`, so redeploying with a new workbook updates the numbers.

## How it handles the data

- **Budget** is the Target column. **An empty cell means not recorded**: it stays empty and is never treated as zero.
- **Weekly grain.** Days roll up to ISO weeks with the rule from the workbook's KPI dictionary (sum, average, last value; Waste is the last value of the week). The target is rolled up with the same rule, using only days that have both an actual and a target.
- **Scoring.** Variance is actual vs target in percent (or in the unit, for temperatures and index KPIs), compared with the green and amber tolerances in `kpis.ts`. A KPI with no target is shown but not scored. A category takes the status of its worst KPI. Cultivations are sorted by most red categories, then amber, then the shortfall on cumulative harvest.
- **Data checks.** Rules: unit slips (Fahrenheit entered as Celsius, fraction entered as percent, factor of 10), impossible values (percent above 100, negative amounts, pH outside 4-9), jumps against the cultivation's own median for the KPI, target and actual more than 2.5x apart (judged per week), and missing values. Ordinary zeros are not flagged. A cell gets at most one flag, from the most specific rule. Each flag has a plain-English explanation and, where one exists, a suggested correction.
- **Decisions.** A flagged value is left out of the scores until a person decides: confirm (use it as recorded), correct (use a new value) or exclude (leave it out). Each decision keeps who, when and a note, in this browser's localStorage (every access is guarded, with an in-memory fallback). The decision log exports and imports as CSV, and the newer decision wins on import. The workbook itself is never changed. The **Show raw data** switch scores everything as recorded.
- **Thresholds are starting values.** With them, many Plant, Climate and Irrigation categories show red, because a category takes its worst KPI. Tune them in `kpis.ts` with the growing team.
- Ontario's two cultivations share a greenhouse but are scored separately. Units are metric; tonnes are kg/m² × growing area ÷ 1000.

## Left out

Forecasting, alerts, logins, editing the plan, grower-level climate detail, financials, and a live data connection.

## Notes

- `npm audit` reports the `xlsx` package (the only way the workbook is read). It is used only at build time, on the committed workbook, and is not shipped to the browser.
