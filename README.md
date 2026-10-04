# Crop Performance

Crop performance vs budget for Perfect Produce greenhouses (Source.ag case).

A web app for the Chief Growing Officer and the Director of Growing. It shows how each of the 8 tomato cultivations (Pennsylvania, Arizona, Ontario) performs against budget, week by week, and it flags inputs that look wrong so a person can verify them before trusting a number.

- **Scorecard** (home): one card per cultivation, worst first. Cumulative harvest vs budget, the week's harvest, fruit weight and waste (waste also has a small meter: the arc fills to the actual, a tick marks the budget, and the scale ends at 120 % of the budget), a status per category (Production, Plant, Climate, Irrigation, Resources) rated from the share of its KPIs that are red or green, with the worst KPI named, and the number of open data flags. Facility and variety filters, and a week picker (default W34, 18-24 Aug 2025).
- **Cultivation detail**: facility, greenhouse, variety, planting date, crop week and growing area; one tab per category; every KPI as actual vs budget (Production, Heating energy, LED lighting) or target (the growing KPIs) over the 13 weeks with the green and amber zones shaded (for higher-is-better or lower-is-better KPIs only the side that counts against the KPI is shaded) and flagged points marked; a weekly table underneath.
- **Facilities**: a summary table at the top (one row per facility and an all-facilities row: this week's harvest and the harvest since planting, each vs budget, with a status), then harvest vs budget per cultivation grouped by facility, as kg/m² and as tonnes, with area-weighted facility totals.
- **Data checks**: the flagged inputs, grouped so a run of the same problem is one item, with three actions on each item (**Confirm values**, **Apply correction**, **Exclude**), a decision log, and CSV export and import.
- **More**: the screens that are not used every day: **Setup**, **Fruit types and specs**, and **About** (data period, how each KPI is scored, generated from the config, assumptions, and what was left out).

It is a static site. By default there is no backend and no login (decisions stay in the browser); with a Supabase project connected (see below) people sign in with an email link and share decisions and, in later steps, their own data. It works on a phone (bottom navigation, no sideways page scroll at 375 px) and installs as a PWA.

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
src/workspace/             everything kept beyond the workbook (decisions, edits, entered days) behind one store interface: memory, this browser (IndexedDB), or Supabase; merge.ts lays it over the workbook data
supabase/schema.sql        the tables and access rules for the shared database
src/setup/                 ids, validation, budget copy and fruit types for the Setup and Fruit types screens (plain functions, tested)
src/state/                 data loading, the selected week and filters
src/screens/               one file per screen
src/components/            small components named after what they show
```

## Shared database (Supabase)

Without any setup the app keeps everything in the browser it runs in, exactly as before. To let several people share decisions (and, in later steps, edits and entered data), connect a free Supabase project. Steps for Mitch:

1. Create a free project at supabase.com.
2. In the project, open **Project Settings > API** and copy the **Project URL** and the **anon / publishable key**. Never use the `service_role` / secret key: it bypasses all access rules and must not be put in the app.
3. In Vercel, open **Settings > Environment Variables** and add `VITE_SUPABASE_URL` (the Project URL) and `VITE_SUPABASE_ANON_KEY` (the anon key) for **Production** and **Preview**. Then redeploy, because the values are read at build time. (For local work, put the same two lines in a `.env.local` file; it is not committed.)
4. In Supabase, open **Authentication > URL Configuration**. Set **Site URL** to the live Vercel URL. Under **Redirect URLs** add `https://*.vercel.app/**` and `http://localhost:5173/**`.
5. Under **Authentication** (Sign In / Providers), turn off new sign-ups, so only people you invite can get in.
6. Open the **SQL Editor** and run the contents of `supabase/schema.sql`. It is safe to run again.
7. Under **Authentication > Users**, invite the people who should have access, by email.

Then open the app, choose **Sign in** in the header, enter an invited email address and follow the link in the email. Notes:

- Supabase's built-in email sender is limited to a few emails per hour. That is enough for a handful of people; for more, add your own SMTP provider under Authentication.
- Signed out, the app shows the workbook data only, read-only. Signed in, decisions are saved for everyone and changes made in another browser appear without reloading.
- If the database cannot be reached, the app shows the last saved copy, read-only, with a banner saying so.
- The first time someone signs in on a browser that holds decisions from before the shared database, the app offers once to upload them.
- If either variable is missing, the app falls back to the browser's own storage and shows no sign-in control.

## Setup and fruit types

Open **More > Setup** to see the facilities, greenhouses and cultivations (the workbook's and new ones) and to add or change them. Changing something saves a record in the workspace on top of the workbook; the workbook file is never touched. Everything here needs a signed-in person when the shared database is set up (otherwise the screens are read-only with a sign-in prompt).

- **Facility**: name, region, currency (USD unless changed). The code (PA, AZ, ON) starts every cultivation id. The workbook has no facility sheet, so its facilities and greenhouses are worked out from the cultivation ids (PA-P1-TOV gives facility PA, greenhouse PA-P1); a greenhouse's area starts as the area of the workbook cultivations in it.
- **Greenhouse**: facility, name, growing area, optional installed LED power (W/m²). Its code (P1, P2) follows the name ("Phase 2" gives P2).
- **Cultivation**: greenhouse, fruit type, variety, planting date, planned end date (48 weeks after planting unless changed) and growing area. The id is built as `<facility code>-<greenhouse code>-<Variety>`, for example `ON-P2-TOV`; if it is taken the form suggests `-2`, and the id can be typed over. On a workbook cultivation you can change the area, planned end date and fruit type.
- The cultivations of a greenhouse together must fit in its area (archived ones do not count), the planting date must not be after the planned end date, and ids must be unique. Names and codes of facilities and greenhouses, and ids, cannot change once set, because cultivations refer to them.
- **Archive** a cultivation instead of deleting it. Archived cultivations keep their history but are hidden on the Scorecard and Facilities unless **Show archived** is on (a switch on Setup, remembered in the browser).
- **Copy budgets from...** (on a cultivation added in the app): pick a cultivation of the same fruit type. Each of its targets is copied as a value edit (reason "Copied from <id>") onto the new cultivation's matching crop day (days since planting), so crop day N lines up with crop day N whatever the calendar dates. Until a cultivation has any targets, its Scorecard card, Facilities row and Cultivation screen say **No budget yet**; with budgets but no recorded values they say **No data yet**. The workbook only covers about 13 weeks per cultivation, so only those crop weeks get budgets. The app opens on the latest week that has recorded values, so budgets copied into later weeks do not move it.

**Fruit types** (More > Fruit types and specs) hold the weight range in grams, an optional diameter range in mm, an optional price per kg (used later in Financials) and a "placeholder" marker. Next to each type is the average fruit weight the workbook measured for the cultivations of that type, as a sanity check. A type in use cannot be removed (the screen names the cultivations using it). Until the workspace has any fruit type the nine starting ones (Grape, Snack, Cherry, Grape on the vine, Cocktail, Plum, Roma, TOV, Beef, all placeholders from `src/setup/fruitTypes.ts`) are shown as defaults; the first change saves all of them as workspace rows. The workbook cultivations default to the type of their variety (TOV, Cherry, Cocktail, Snack) until one is chosen on Setup. On a Cultivation screen, the Fruit weight card says whether the selected week's average is under, within or over the type's range.

## Change a threshold or a KPI

Everything that decides a score is in **`src/config/kpis.ts`**, one line per KPI:

```ts
{ name: 'Harvest', category: 'Production', unit: 'kg/m²', aggregation: 'sum', planLabel: 'budget', ...higherIsBetter(), showOnScorecard: true, decimals: 2 },
```

- Change tolerances by passing numbers to the helper, or change the helper's defaults to move many KPIs at once. The current defaults and exceptions:

  | KPIs | Helper | Green | Amber |
  | --- | --- | --- | --- |
  | Harvest, Cumulative harvest | `higherIsBetter()` | down to -3 % | down to -8 % |
  | Fruit weight | `closeToTarget(5, 10)` | within ±5 % | within ±10 % |
  | Waste | `lowerIsBetterAbsolute(0.5, 1.5)` | up to +0.5 percentage points | up to +1.5 points |
  | Heating energy, LED lighting | `lowerIsBetter()` | up to +10 % | up to +25 % |
  | The four temperature KPIs | `closeToTargetAbsolute(1.5, 3)` | within ±1.5 °C | within ±3 °C |
  | Plant balance factor, Generative trend indicator | `closeToTargetAbsolute(0.25, 0.5)` / `(0.15, 0.3)` | within ±0.25 / ±0.15 | within ±0.5 / ±0.3 |
  | Every other KPI with a target | `closeToTarget()` | within ±10 % | within ±20 % |

  The `...Absolute` helpers take a tolerance in the KPI's own unit instead of percent of the plan value (waste is a small percentage, so it is judged in percentage points).
- Change the category rule in `CATEGORY_ROLLUP` at the bottom of the file: `{ redShare: 1 / 3, greenShare: 2 / 3 }` means a category is red when at least a third of its scored KPIs are red, green when at least two thirds are green (and fewer than a third red), amber otherwise.
- Change the direction of a KPI by swapping the helper on its line.
- `showOnScorecard` picks the headline numbers on each card. `decimals` is how values are shown.
- `gauge: { rangeOfBudget: 1.2 }` on a KPI's line gives its Scorecard tile a semicircular meter that runs from 0 to that multiple of the week's budget (or target), with a tick at the budget. Waste has one. Change the number to rescale it (it must be 1 or more), delete the setting to remove it, or add it to another headline KPI. An actual beyond the end of the scale fills the arc and says "Off the scale" (with a warning icon only when the tile is off target); a week with no actual or no budget gets no meter.
- `planLabel` is the word for the plan value on screen: `'budget'` for Production, Heating energy and LED lighting, `'target'` for every other KPI. Change it on a KPI's line and every screen, tooltip and explanation follows (`planWord()` in the same file). The Scorecard headline numbers and the Facilities screen only show Production KPIs, so they say budget.
- `aggregation` must match the workbook's KPI dictionary (sum, average or last value). The build fails if it does not.
- To add a KPI: add it to the workbook's KPI dictionary and add a line here. A KPI without a plan value in the data is shown but not scored; nothing else needs to change.

The About screen's scoring tables are generated from this file, so they always match.

The data checks have their own knobs in `src/flags/settings.ts`: the ratios for a "jump" (2.5x and 0.4x), the "far apart" factor (2.5x), how many weeks a young crop is left alone, and per-KPI exceptions (for example Harvest is only flagged when too high, and weather-driven KPIs skip the jump check).

## Change the look

The colours are tokens at the top of **`src/index.css`**. Nothing in the app is white: the surfaces are steps of one green. `page` is the mid-green background; `card` is a paler green (every data cluster sits on one, and so do the header and the bottom bar); `tile` is paler again (a cluster inside a card, so tiles read as rows and columns, and the inactive filter pills); and `field` is the palest green, for inputs, selects and the buttons that sit on a card. The page, card and tile greens are the ones picked on a screenshot, so leave them alone. The rest of the tokens are derived from them: the line colours (`line`, `line-soft`, `line-strong`, `track`), the ink (text) steps, the brand and status colours and the chart marks.

Text straight on the page is `ink`; `ink-2` and `ink-3` are the quieter steps for text inside cards, tiles and fields (they are too pale for the mid-green page). The browser's scroll bars get a clear track and a `line-strong` thumb (the `html` rule), so no white strip shows down the side. The On track and Watch shading on the KPI charts, and their legend swatches, come from one place, `src/components/detail/chartBands.ts`: a pale green band darker than the tile and a pale amber band lighter than it. Change a value in `index.css` and every screen follows; `src/theme.test.ts` reads the file and fails if a surface turns white or stops stepping from dark to light, or if a pair of colours that are used together stops meeting WCAG AA (4.5:1 for text, 3:1 for marks and control edges). The PWA's `theme_color` and `background_color` (in `vite.config.ts`) and the `theme-color` meta tag (in `index.html`) match the card and page greens.

## Deploy to Vercel

1. Push the repository and import it in Vercel.
2. Framework preset **Vite**; leave the defaults (build command `npm run build`, output directory `dist`, install command `npm install`).
3. Deploy. No `vercel.json` is needed: the app uses hash routes (`/#/checks`), so every address is served by `index.html`.

The build reads the workbook from `data/` and generates `data.json`, so redeploying with a new workbook updates the numbers.

## How it handles the data

- **Budget and target** are both the workbook's Target column; the app says budget for Production, Heating energy and LED lighting and target for the growing KPIs (`planLabel`). **An empty cell means not recorded**: it stays empty and is never treated as zero.
- **Weekly grain.** Days roll up to ISO weeks with the rule from the workbook's KPI dictionary (sum, average, last value; Waste is the last value of the week). The target is rolled up with the same rule, using only days that have both an actual and a target.
- **Scoring.** Variance is actual vs target in percent (or in the KPI's own unit, for temperatures, index KPIs and waste, which is in percentage points), compared with the green and amber tolerances in `kpis.ts`. A KPI with no target is shown but not scored. A category is red when at least a third of its scored KPIs are red, green when at least two thirds are green (and fewer than a third red) and amber otherwise (`CATEGORY_ROLLUP`); its badge line still names the worst KPI. Cultivations are sorted worst first by Production status (red, amber, green, not scored), because production against budget is the outcome and the other four categories are drivers; then by the number of red and then amber categories among those four, then by the shortfall on cumulative harvest.
- **Data checks.** Rules: unit slips (Fahrenheit entered as Celsius, fraction entered as percent, factor of 10), impossible values (percent above 100, negative amounts, pH outside 4-9), jumps against the cultivation's own median for the KPI, budget or target and actual more than 2.5x apart (judged per week), and missing values. Ordinary zeros are not flagged. A cell gets at most one flag, from the most specific rule. Each flag has a plain-English explanation and, where one exists, a suggested correction.
- **Decisions.** A flagged value is left out of the scores until a person decides, with one of three actions: **Confirm values** (kept exactly as recorded and counted in the scores), **Apply correction** (the suggested value, or one typed in, is used instead) or **Exclude** (left out of the scores). Once decided, the item reads `Values confirmed by <name>`, `Correction applied: <value> by <name>` or `Excluded by <name>` and can be reopened; the Missing tab offers Confirm values and Apply correction only, because a missing value is already left out. The stored decision ids (`confirm`, `correct`, `exclude`) and the CSV columns are unchanged, so older exports still import. Each decision keeps who, when and a note, in this browser's localStorage (every access is guarded, with an in-memory fallback). The decision log exports and imports as CSV, and the newer decision wins on import. The workbook itself is never changed. The **Show raw data** switch scores everything as recorded.
- **Thresholds are starting values.** They were calibrated against this workbook so that the badges are not all red, but they are not agreed standards. Tune them in `kpis.ts` with the growing team.
- Ontario's two cultivations share a greenhouse but are scored separately. Units are metric; tonnes are kg/m² × growing area ÷ 1000.

## Left out

Forecasting, alerts, logins, editing the plan, grower-level climate detail, financials, and a live data connection.

## Notes

- `npm audit` reports the `xlsx` package (the only way the workbook is read). It is used only at build time, on the committed workbook, and is not shipped to the browser.
