# Crop Performance

Crop performance vs budget for Perfect Produce greenhouses (Source.ag case).

A web app for the Chief Growing Officer and the Director of Growing. It shows how each of the 8 tomato cultivations (Pennsylvania, Arizona, Ontario) performs against budget, week by week, and it flags inputs that look wrong so a person can verify them before trusting a number.

- **Scorecard** (home): one card per cultivation, worst first. Cumulative harvest vs budget, the week's harvest, fruit weight and waste (waste also has a small meter: the arc fills to the actual, a tick marks the budget, and the scale ends at 120 % of the budget), a status per category (Production, Plant, Climate, Irrigation, Resources) rated from the share of its KPIs that are red or green, with the worst KPI named, and the number of open data flags. Facility and variety filters, and a week picker (default W34, 18-24 Aug 2025).
- **Cultivation detail**: facility, greenhouse, variety, planting date, crop week and growing area; one tab per category; every KPI as actual vs budget (Production, Heating energy, LED lighting) or target (the growing KPIs) over the 13 weeks with the green and amber zones shaded (for higher-is-better or lower-is-better KPIs only the side that counts against the KPI is shaded) and flagged points marked; a weekly table underneath. The **Climate** tab has two views, **Daily charts** (the default; see Climate below) and **Weekly scores**.
- **Facilities**: a summary table at the top (one row per facility and an all-facilities row: this week's harvest and the harvest since planting, each vs budget, with a status), then harvest vs budget per cultivation grouped by facility, as kg/m² and as tonnes, with area-weighted facility totals.
- **Financials**: revenue, value lost to waste, energy and water cost and a partial margin per facility and per cultivation, each against budget, with the forecast revenue; see Financials below.
- **Data** (`/data`): a hub for **Data checks**, **Enter data**, **Import**, **Export** and the **Edit log**; the tab shows the number of open data checks. **Data checks**: the flagged inputs, grouped so a run of the same problem is one item, with three actions on each item (**Confirm values**, **Apply correction**, **Exclude**), a decision log, and CSV export and import.
- **More**: the screens that are not used every day: **Forecast**, **Setup**, **Commodities (fruit types)**, **Prices and costs**, and **About** (data period, how each KPI is scored, generated from the config, assumptions, and what was left out).

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
src/entry/                 typed entries: kg to kg/m², the weekly registration day (plain functions, tested)
src/exchange/              import (parse, preview) and export (one function per sheet); SheetJS is only loaded in xlsxFile.ts
src/climate/               the Climate tab: day status, day/night difference, RTR line, shared-greenhouse pairing, climate import and 24-hour series (plain functions, tested)
src/financials/            revenue, waste value, energy and water cost, margin and gap to budget, prices and rates (plain functions, tested)
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

**Commodities** are the app's fruit types (More > Commodities (fruit types), `/fruit-types`). **Add a commodity** is a button at the top of that screen and of Prices and costs; both open the same form (`src/components/setup/FruitTypeForm.tsx`). A new commodity can be chosen for a cultivation in Setup and priced in Financials straight away. Fruit types hold the weight range in grams, an optional diameter range in mm, an optional price per kg (used later in Financials) and a "placeholder" marker. Next to each type is the average fruit weight the workbook measured for the cultivations of that type, as a sanity check. A type in use cannot be removed (the screen names the cultivations using it). Until the workspace has any fruit type the nine starting ones (Grape, Snack, Cherry, Grape on the vine, Cocktail, Plum, Roma, TOV, Beef, all placeholders from `src/setup/fruitTypes.ts`) are shown as defaults; the first change saves all of them as workspace rows. The workbook cultivations default to the type of their variety (TOV, Cherry, Cocktail, Snack) until one is chosen on Setup. On a Cultivation screen, the Fruit weight card says whether the selected week's average is under, within or over the type's range.

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

## Editing budgets and targets

Each KPI card on a cultivation has **Edit budget** or **Edit target** (the word is the KPI's `planLabel`). The sheet that opens has three modes: **One week** (pick a week, type its new weekly value), **From a week onward** (the value applies from that week to the cultivation's planned end date, or to the last day with data when there is none) and **Scale a range** (plus or minus a percentage on weeks X to Y). The weekly value is turned into daily values by the KPI's own roll-up rule: a **sum** is spread over the days of the week that have a row, in proportion to the daily targets they have now (evenly when there are none); an **average** or **last value** is set on every day of the week. Days with no row are never created. The preview shows each week's value now and after.

Before saving, the new values go through the same data checks as recorded values (`src/editing/precheck.ts`): unit slips, impossible values, a jump against the cultivation's own median, and budget or target far from the actual. When one fires, the sheet shows its plain explanation and **Use suggestion** (where there is one), **Save anyway** or **Cancel**. A short reason is optional and saved as "Edited" when empty.

An edit is saved as value edits (field `target`, source `edited`, with who, when, the reason and the value before), one per run of days with the same value, in one batch; the workbook is not changed. Scores use the edited values. Where a budget or target was edited the chart draws the original as a thin dotted line (legend "Original budget" or "Original target") and the weekly table marks the week "edited". **Show raw data** ignores edited budgets and targets (only budgets copied onto a new cultivation stay, since they are that cultivation's whole budget).

The **Edit log** (Data, or the link on a cultivation that has edits; `/edits`) lists every value edit and every entered or imported group of days, newest first, filterable by cultivation, with who, when, KPI, weeks, old and new weekly value, reason and **Undo**. A budget copy is one line. Undo removes the edit, so the value before comes back; undoing a correction goes through the same path as reopening it in Data checks, so the decision and its edit stay together. Editing and undoing need a signed-in user when a shared database is set up, like every other change.

## Entering, importing and exporting data

**Data > Enter data** (`/data/enter`) has three forms. Every entry is saved as an entered row (source `entered`, with who and when) that replaces the workbook's cell for that cultivation, KPI and day; a value left empty keeps what the day had. Before saving, the values go through the same flag pre-check as edited budgets (`precheckValues` in `src/editing/precheck.ts`), with **Use suggestion**, **Save anyway** and **Cancel**: typing 69 for Temperature (24h) suggests 20.6. Like a day with no actual in the detector, a target typed for a day without an actual is not checked. Entered days show "Entered" in the weekly table of the Cultivation screen and appear in the Edit log with **Undo**. An entry after the last data week makes that week the default week.

- **Daily production**: cultivation, date and Harvest, typed as kg/m² or as a total in kg, which is divided by the cultivation's growing area (the resulting kg/m² is shown).
- **Weekly crop registration**: cultivation and week, one field per Plant KPI plus Waste, each with last week's value and its unit; empty fields are skipped. The day a value is saved on: when at least 80 % of the values a cultivation has for that KPI fall on one weekday, that weekday (the workbook has the Plant KPIs on Mondays and Waste on Sundays); a cultivation with no values follows the other cultivations; otherwise the Monday of the week (`src/entry/registration.ts`).
- **Single value**: cultivation, date, KPI, and the actual and/or the budget or target.

**Data > Import** (`/data/import`) takes an .xlsx or .csv with the columns Date, Cultivation, KPI, Actual and Target (headers are matched without regard to case or spaces; other columns are ignored; dates may be Excel day counts or `2025-08-18`). The original workbook works too: its "KPIs" sheet is read. SheetJS is loaded only then. A preview comes first: new days, changed values (different from what the app shows now), unchanged ones (skipped), the problems (unknown cultivation or KPI, a date or number it cannot read, a day listed twice) with their row numbers, and how many values the data checks would flag. An empty cell leaves the day's value as it is. **Import** saves the rows with source `imported`, 4,000 at a time so a file of 16,000 rows keeps the screen responsive; the Edit log shows each import as one entry that can be undone. Importing an export of the app gives no changes.

**Data > Import market prices** (`/data/import/prices`, also linked from Import and from Prices and costs) takes an .xlsx (the sheet called Prices, the only sheet, or the first with the columns) or a .csv of current market prices per commodity. Columns (headers matched without regard to case; others ignored):

| Column | Needed | Meaning |
| --- | --- | --- |
| Commodity | yes | A fruit type's name or id (`TOV`, `grape-on-the-vine`), any case |
| Price | yes | Price per unit; `2,8` and `2.8` both work; 0 or more |
| Facility | no | A facility's name or id. Sets that facility's own price instead of the general one |
| Currency | no | Must be the facility's currency (the app's, USD, for a general price). Empty means that currency |
| Date | no | The day the price is for (`2026-10-04` or an Excel date); today if empty |
| Unit | no | `kg` (or empty) or `lb`; a price per lb is converted to per kg |

A preview comes first: prices that change (old to new, with the change in percent), unchanged ones (skipped), problems with row numbers (unknown facility, a price that is not a number or is negative, a currency that does not match, a commodity and facility listed twice: the first one is used), and **unknown commodities**, each with a checkbox (off by default) "Create as a new commodity". A ticked one is created (placeholder weight range 1-500 g until the real specs are entered) and priced in the same apply; rows of an unticked one are left out. Nothing is saved until **Apply**. A general price is saved on the fruit type and a facility price in that facility's `rates` row, so both sync like every other price, and importing a price switches the example prices off. Each imported price keeps a note (the date it is for, who imported it, when), shown as "Market price as of 4 Oct 2026" on Prices and costs and on Commodities (fruit types); typing another price over it removes the note. A sample is in `public/samples/market-prices-sample.csv` (all nine commodities, an Ontario price for TOV and a new commodity, Mini plum). The code is `src/exchange/priceFile.ts` (reading the rows), `src/exchange/pricePreview.ts` (preview and the rows to save) and `src/screens/PriceImportScreen.tsx`.

**Database change.** The notes are kept in two new columns, `fruit_types.price_source` and `rates.price_sources` (jsonb), added to `supabase/schema.sql` with `add column if not exists`. **Re-run the file once in the Supabase SQL Editor** (it is idempotent); until then, saving a price import with the shared database fails with a message and the rest of the app is unaffected.

**Data > Export** (`/data/export`) builds `crop-performance-YYYY-MM-DD.xlsx` with the sheets Read me, Greenhouses, KPIs (the workbook's columns with the values in use, plus Original actual, Original target and Source: workbook, entered, imported, edited or corrected), Weekly scores, Forecast (one row per cultivation and forecast week: low, expected, high, method), Financials (one row per cultivation and week: revenue, value lost to waste, heating, LED and water cost, partial margin, each with its budget, and the volume and cost effects), Data checks, Edit log and Settings (fruit types, and the prices and rates per facility). Each sheet is one function in `src/exchange/exportBook.ts`; to add a sheet, write one and add it to `EXPORT_SHEETS`. The Scorecard, Facilities and Financials screens have **Export this view**, which exports their table for the selected week.

Entering and importing need a signed-in user when a shared database is set up (the name is typed in otherwise), like every other change.

## Forecasting

The settings are in one file, **`src/forecast/config.ts`**: `calibrationWeeks` (4), `horizonWeeks` (6), `uncorrectedRange` (0.4 to 1.4), `holdLatestWeeks`, the backtest's `backtestAsOfWeek` (W28) and `minActualForPercentError`. The **Forecast** screen (More > Forecast, `/forecast`) shows the next six weeks per cultivation, how they are made, the season end, and **How good is this?**.

- **Estimate.** Fruit set in a week is harvested about one fruit development time later (the days over seven, rounded to whole weeks). The harvest expected in week *w* is the fruit set of week *w* minus that shift × the fruit weight ÷ 1000. Units: fruit set is fruits/m² in the week, fruit weight is grams per fruit, so fruits/m² × g ÷ 1000 is kg/m² a week, the unit of Harvest (reasoning in `src/forecast/estimate.ts`). A number that has not happened yet (fruit set after the last data week, the weight and development time of the weeks ahead) is the average of the latest `holdLatestWeeks` recorded weeks.
- **Correction.** Per cultivation, the factor is the actual harvest over the estimate across the last 4 weeks (total over total). The range is the lowest and highest single week. With fewer than 4 comparable weeks (a harvest recorded and an estimate above zero) the estimate is **not corrected**, the range is 0.4 to 1.4 times it, and every screen says Uncorrected.
- **Season end** is shown only when a Harvest budget exists after the last data week: harvest to date + the six weeks + the remaining budget (the weeks after the six) × actual/budget over the last 4 weeks. The workbook has no budget after 24 Aug 2025, so the Scorecard cards say so once, in one line, and show Forecast at end only on a cultivation that has one.
- **Where it shows.** A dashed line with a shaded range after the actuals on the Harvest and Cumulative harvest charts; a forecast tile on the Production tab with a link to **How good is this?**; the six-week expected harvest in kg (kg/m² × growing area) per cultivation and facility on Facilities; and the Forecast sheet of the export. The forecast reads the same weekly values as the scores (workspace edits, entered days and imported days included, data-check decisions applied, "Show raw data" respected).
- **How good is this?** reruns the forecast as of W28, using only what was recorded up to then, and compares it with the real W29 to W34: the average absolute percentage error of the weeks, and the six weeks in total. The fruit set the estimate needs goes back 5 to 8 weeks and the data starts at W22, so as of W28 no cultivation has 4 comparable weeks: the backtest therefore measures the uncorrected estimate (and ON-P1-TOV has no estimate that early).

## Financials

The workbook has no prices or costs, so Financials works from a short list of rates people enter on **More > Prices and costs** (`/prices`): heat per kWh, electricity per kWh and water per m³ for each facility, and a price per kg for each fruit type, with an optional price per facility that beats the fruit type's own (the fruit type's price is also on **Commodities (fruit types)**). They are kept in the workspace's `rates` rows (one per facility, with who changed it and when) and sync like everything else. All money is in the facility's currency (USD by default; the all-facilities row appears only when the facilities share one).

**Example prices.** Until a price is entered anywhere (on a fruit type, or as a facility price), Financials shows a banner and uses example prices per fruit type (`src/financials/defaults.ts`, for example TOV 2.50 USD/kg). After the first price is entered the banner goes, and a fruit type still without a price has no revenue ("no price") instead of an invented one. A heat, electricity or water rate that is not entered falls back to an example rate, said in a note under the banner; that note is not the banner.

**Formulas** (area is the growing area in m², and each week's figure is made from that week's values; a budget is worked out the same way from the budget values):

- Revenue = harvest (kg/m²) × area × price per kg. Harvest is already net of waste, so waste is not subtracted again.
- Value lost to waste = harvest × w ÷ (1 − w) × area × price, with w the Waste % as a fraction: if 3 % of what was picked is waste, the net harvest is 97 % of it and the waste is 3/97 of the net harvest.
- Heat cost = Heating energy (kWh/m²) × area × heat price per kWh.
- LED cost = LED lighting (hours) × installed LED power (W/m²) ÷ 1000 × area × electricity price per kWh. The KPI is hours, not kWh. The installed power is on the greenhouse (Setup); the workbook's greenhouses have none, so a placeholder of 150 W/m² (`PLACEHOLDER_LED_W_PER_M2`) is used and marked on the screen until one is entered.
- Water cost = Irrigation water (L/m²) ÷ 1000 × area × water price per m³. The workbook has no irrigation water target, so its budget cost stays empty ("no target") until one is entered.
- Partial margin = revenue − heat − LED − water. Labour, plants and packaging are not in the data.
- Against budget: the same sums on the budget values. The gap in the partial margin is split into a **volume effect** (revenue actual − revenue budget: the price is the same on both sides, so it is all kg) and a **cost effect** (budgeted energy cost − actual energy cost). They add up to the gap exactly. A cost with no budget (irrigation water, and LED in a week with no LED budget) is left out of both sides of the gap, and the card says how much that is.
- A comparison only uses weeks where the actual and the budget are both known (the same paired rule as the scores). A missing input gives a missing figure, never zero.
- Forecast revenue = the forecast's expected harvest and its low and high (kg/m²) × area × price, for the six forecast weeks, as a range. When the forecast has a season end (it needs a Harvest budget after the last data week; the workbook has none) the revenue from the first forecast week to the season end is shown too.

**The screen** (`/financials`, the third tab) follows the week picker. A "Money at a glance" table (a row per facility and one for all, revenue, energy and water cost, and margin, each against budget with a status) sits above a card per cultivation (the lines above, the gap split, the price used, the forecast revenue). A switch chooses that week or the weeks since the start of the data (W22): the workbook starts after planting, so costs and revenue cover the same weeks. **Export this view** gives one sheet, and the full export has a Financials sheet (per cultivation and week) and the rates on the Settings sheet.

**Database change.** This step adds `price_overrides`, `updated_by` and `updated_at` to `public.rates`. `supabase/schema.sql` does this with `add column if not exists`, so re-run it once in the Supabase SQL Editor (it is safe to run again); until then saving rates from the app fails with a message.

## Climate

The **Climate** tab of a cultivation has a **Daily charts** view (default) next to the **Weekly scores** cards. It shows the daily values a grower steers on; the workbook holds daily values only. It reads the same days as the scores: the workspace laid over the workbook (edits, entered and imported days), flagged values left out until decided, or the recorded values with **Show raw data** on. **Days shown** is the picked week by default, or the whole period.

- **Days off target**: a strip per climate KPI (all ten of the Climate category), one cell per day, coloured by the same rule as the weekly scores applied to one day (tolerances from `src/config/kpis.ts`), each with a glyph and legend so colour is never alone. The strip scrolls sideways inside its card.
- **Flagged, not red.** A day whose actual or target the data checks flagged, and nobody has decided on, shows as **flagged** (violet, flag glyph) and is not scored: PA-P2-TOV's 21 days with a Temperature (24h) target of 69 (a Fahrenheit slip, 69 °F is 20.6 °C) are flagged, not red. After a decision the day is scored again: **Confirm values** keeps the 69 (so the day is red), **Apply correction** scores against the corrected target, **Exclude** leaves the value out (no data). A violet dot marks a day with a decided flag. With **Show raw data** on, such a day is scored from the value as recorded and carries the dot. The rule is `dayVerdict()` in `src/climate/status.ts`.
- **Temperature**: 24 h, day and night, actual against target per day with the On track and Watch bands, and the day/night difference. The difference is the workbook's KPI; where that has no value for a day and both temperatures exist, it is day minus night (the same for the target), so it always agrees with the charts above it.
- **Light**: the 24-hour temperature against the day's solar radiation (bars), with the **RTR target as a line**. The workbook does have an RTR KPI, defined as the 24-hour temperature divided by the day's solar radiation sum (°C per J/cm²), with a target on some cultivations (PA-P2-TOV has 0.012; Ontario has none). A ratio target times the day's radiation is the 24-hour temperature that would hit the target that day, so that is the dashed line (`rtrTemperature()` in `src/climate/series.ts`). Nothing is invented: a cultivation or day without an RTR target gets no line, and the card says so. There is also an RTR chart of its own, and the **PAR light sum** (with its target) next to the **LED hours**.
- **Humidity and CO₂**: relative humidity, humidity deficit and CO₂ (day) against target with the green band from `kpis.ts`.
- **Same greenhouse**: any cultivation that shares a facility and greenhouse with another live cultivation gets an overlay of the two for a chosen climate KPI (Ontario's Cherry and TOV in Phase 1; the second crop is drawn in its own colour with diamond marks). Under it: on how many days they differ at all, and by more than the KPI's green tolerance; across all climate KPIs, the share of day-by-KPI comparisons that differ (86 % in the workbook: the two read different numbers nearly every day, to the decimal); and, for solar radiation, which is measured outside and should be identical, how often it differs (never). The text asks whether it is a sensor or a data question.
- **Hour by hour** (finer data): without readings the card says this data is not connected yet. With readings imported for the cultivation, a chosen day shows a 24-hour chart per parameter, realised against setpoint, with the average gap. **Remove these readings** deletes a cultivation's readings (asks first).

**Importing climate readings** (Data > **Import climate readings**, `/data/import/climate`): a CSV or an .xlsx (the sheet called Climate, the only sheet, or the first with the columns) with the columns **Timestamp, Cultivation, Parameter, Value, Setpoint** (headers matched without regard to case; Setpoint may be empty or the column left out; other columns are ignored). The timestamp is local time as written (`2025-08-20 14:00`, or an Excel date and time), to the minute, with no time zone applied. Parameter is free text (Temperature, Relative humidity, CO2). A preview comes first (new, changed and unchanged readings, what the file covers, and problems with row numbers) and nothing is saved until you press Import. **Limit: 20,000 rows per file** (`MAX_CLIMATE_ROWS` in `src/climate/import.ts`); a bigger file is refused whole, so send a month at a time. A small sample is in `public/samples/climate-sample.csv` (two days of PA-P2-TOV; it is also linked from the import screen). Readings are keyed by cultivation, parameter and minute, so importing the same file again changes nothing. They are saved 4,000 at a time and, with the shared database, upserted 1,000 rows at a time. They are not part of the Excel export or the Edit log yet.

**Database change.** This step adds the table `public.climate_readings` (with row-level security for signed-in people and the realtime publication) to `supabase/schema.sql`. **Re-run the file once in the Supabase SQL Editor** (it is idempotent); until then importing readings with the shared database fails with a message and the rest of the app is unaffected.

## Left out

Alerts, what-if scenarios, logins, a live connection to the climate computer (climate detail finer than a day comes only from imported files, with no per-zone data), a full profit and loss (labour, plants and packaging are not in the data, so the margin is partial), and a live data connection.

## Notes

- `npm audit` reports the `xlsx` package (the only way the workbook is read). It is used only at build time, on the committed workbook, and is not shipped to the browser.
