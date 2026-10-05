-- Crop Performance: shared database for the Supabase SQL editor.
-- Safe to run more than once. Run it on an empty project, then invite people under Authentication > Users.
--
-- Every table has created_by (the signed-in user's id) and created_at, both filled in by the database.
-- Only signed-in people can read or change anything (row-level security). Turn off new sign-ups so
-- only people you invite are signed in.

create table if not exists public.facilities (
  id text primary key,
  name text not null,
  region text not null default '',
  currency text not null default 'USD',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.greenhouses (
  id text primary key,
  facility_id text not null,
  name text not null,
  area_m2 double precision not null,
  led_watts_per_m2 double precision,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.cultivations (
  id text primary key,
  facility text not null,
  greenhouse text not null,
  crop text not null,
  variety text not null,
  planting_date date not null,
  area_m2 double precision not null,
  crop_week_at_end integer not null default 0,
  fruit_type text,
  planned_end_date date,
  archived boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.value_edits (
  id text primary key,
  cultivation text not null,
  kpi text not null,
  date_from date not null,
  date_to date not null,
  field text not null check (field in ('actual', 'target')),
  new_value double precision not null,
  original_value double precision,
  created_by_name text not null default '',
  reason text not null default '',
  source text not null check (source in ('edited', 'corrected', 'entered', 'imported')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.entered_rows (
  cultivation text not null,
  date date not null,
  kpi text not null,
  actual double precision,
  target double precision,
  created_by_name text not null default '',
  source text not null check (source in ('edited', 'corrected', 'entered', 'imported')),
  primary key (cultivation, kpi, date),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.fruit_types (
  id text primary key,
  name text not null,
  weight_min_g double precision not null,
  weight_max_g double precision not null,
  diameter_min_mm double precision,
  diameter_max_mm double precision,
  price_per_kg double precision,
  placeholder boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.rates (
  facility_id text primary key,
  heat_per_kwh double precision,
  electricity_per_kwh double precision,
  water_per_m3 double precision,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Step 6 (Financials): price overrides per fruit type for the facility, and who changed the row and when.
-- Idempotent: safe to run again, and needed once on a database created before this step.
alter table public.rates add column if not exists price_overrides jsonb;
alter table public.rates add column if not exists updated_by text;
alter table public.rates add column if not exists updated_at timestamptz;

-- Market prices: where an imported price came from (the date it is for, who imported it, when), as json.
-- price_source: on the fruit type's own price. price_sources: on a facility's prices, by fruit type id.
-- Idempotent: safe to run again, and needed once on a database created before this step.
alter table public.fruit_types add column if not exists price_source jsonb;
alter table public.rates add column if not exists price_sources jsonb;

-- Step 7 (Climate): finer climate data from a climate computer export (timestamp, cultivation, parameter, value, setpoint).
-- New table, so re-run this file once in the SQL Editor on a database created before this step (safe to run again).
-- The timestamp is kept as text ("2025-08-20T14:30", local time as in the file) so no time zone shifts it.
create table if not exists public.climate_readings (
  cultivation text not null,
  parameter text not null,
  timestamp text not null,
  value double precision not null,
  setpoint double precision,
  created_by_name text not null default '',
  primary key (cultivation, parameter, timestamp),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.decisions (
  cell_id text primary key,
  cultivation text not null,
  kpi text not null,
  date date not null,
  field text not null check (field in ('actual', 'target')),
  rule text not null,
  original_value double precision,
  kind text not null check (kind in ('confirm', 'correct', 'exclude')),
  corrected_value double precision,
  decided_by text not null default '',
  decided_at timestamptz not null,
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Row-level security and policies: signed-in people only.
alter table public.facilities enable row level security;
drop policy if exists "facilities select for signed-in people" on public.facilities;
create policy "facilities select for signed-in people" on public.facilities for select to authenticated using (true);
drop policy if exists "facilities insert for signed-in people" on public.facilities;
create policy "facilities insert for signed-in people" on public.facilities for insert to authenticated with check (true);
drop policy if exists "facilities update for signed-in people" on public.facilities;
create policy "facilities update for signed-in people" on public.facilities for update to authenticated using (true) with check (true);
drop policy if exists "facilities delete for signed-in people" on public.facilities;
create policy "facilities delete for signed-in people" on public.facilities for delete to authenticated using (true);

alter table public.greenhouses enable row level security;
drop policy if exists "greenhouses select for signed-in people" on public.greenhouses;
create policy "greenhouses select for signed-in people" on public.greenhouses for select to authenticated using (true);
drop policy if exists "greenhouses insert for signed-in people" on public.greenhouses;
create policy "greenhouses insert for signed-in people" on public.greenhouses for insert to authenticated with check (true);
drop policy if exists "greenhouses update for signed-in people" on public.greenhouses;
create policy "greenhouses update for signed-in people" on public.greenhouses for update to authenticated using (true) with check (true);
drop policy if exists "greenhouses delete for signed-in people" on public.greenhouses;
create policy "greenhouses delete for signed-in people" on public.greenhouses for delete to authenticated using (true);

alter table public.cultivations enable row level security;
drop policy if exists "cultivations select for signed-in people" on public.cultivations;
create policy "cultivations select for signed-in people" on public.cultivations for select to authenticated using (true);
drop policy if exists "cultivations insert for signed-in people" on public.cultivations;
create policy "cultivations insert for signed-in people" on public.cultivations for insert to authenticated with check (true);
drop policy if exists "cultivations update for signed-in people" on public.cultivations;
create policy "cultivations update for signed-in people" on public.cultivations for update to authenticated using (true) with check (true);
drop policy if exists "cultivations delete for signed-in people" on public.cultivations;
create policy "cultivations delete for signed-in people" on public.cultivations for delete to authenticated using (true);

alter table public.value_edits enable row level security;
drop policy if exists "value_edits select for signed-in people" on public.value_edits;
create policy "value_edits select for signed-in people" on public.value_edits for select to authenticated using (true);
drop policy if exists "value_edits insert for signed-in people" on public.value_edits;
create policy "value_edits insert for signed-in people" on public.value_edits for insert to authenticated with check (true);
drop policy if exists "value_edits update for signed-in people" on public.value_edits;
create policy "value_edits update for signed-in people" on public.value_edits for update to authenticated using (true) with check (true);
drop policy if exists "value_edits delete for signed-in people" on public.value_edits;
create policy "value_edits delete for signed-in people" on public.value_edits for delete to authenticated using (true);

alter table public.entered_rows enable row level security;
drop policy if exists "entered_rows select for signed-in people" on public.entered_rows;
create policy "entered_rows select for signed-in people" on public.entered_rows for select to authenticated using (true);
drop policy if exists "entered_rows insert for signed-in people" on public.entered_rows;
create policy "entered_rows insert for signed-in people" on public.entered_rows for insert to authenticated with check (true);
drop policy if exists "entered_rows update for signed-in people" on public.entered_rows;
create policy "entered_rows update for signed-in people" on public.entered_rows for update to authenticated using (true) with check (true);
drop policy if exists "entered_rows delete for signed-in people" on public.entered_rows;
create policy "entered_rows delete for signed-in people" on public.entered_rows for delete to authenticated using (true);

alter table public.climate_readings enable row level security;
drop policy if exists "climate_readings select for signed-in people" on public.climate_readings;
create policy "climate_readings select for signed-in people" on public.climate_readings for select to authenticated using (true);
drop policy if exists "climate_readings insert for signed-in people" on public.climate_readings;
create policy "climate_readings insert for signed-in people" on public.climate_readings for insert to authenticated with check (true);
drop policy if exists "climate_readings update for signed-in people" on public.climate_readings;
create policy "climate_readings update for signed-in people" on public.climate_readings for update to authenticated using (true) with check (true);
drop policy if exists "climate_readings delete for signed-in people" on public.climate_readings;
create policy "climate_readings delete for signed-in people" on public.climate_readings for delete to authenticated using (true);

alter table public.fruit_types enable row level security;
drop policy if exists "fruit_types select for signed-in people" on public.fruit_types;
create policy "fruit_types select for signed-in people" on public.fruit_types for select to authenticated using (true);
drop policy if exists "fruit_types insert for signed-in people" on public.fruit_types;
create policy "fruit_types insert for signed-in people" on public.fruit_types for insert to authenticated with check (true);
drop policy if exists "fruit_types update for signed-in people" on public.fruit_types;
create policy "fruit_types update for signed-in people" on public.fruit_types for update to authenticated using (true) with check (true);
drop policy if exists "fruit_types delete for signed-in people" on public.fruit_types;
create policy "fruit_types delete for signed-in people" on public.fruit_types for delete to authenticated using (true);

alter table public.rates enable row level security;
drop policy if exists "rates select for signed-in people" on public.rates;
create policy "rates select for signed-in people" on public.rates for select to authenticated using (true);
drop policy if exists "rates insert for signed-in people" on public.rates;
create policy "rates insert for signed-in people" on public.rates for insert to authenticated with check (true);
drop policy if exists "rates update for signed-in people" on public.rates;
create policy "rates update for signed-in people" on public.rates for update to authenticated using (true) with check (true);
drop policy if exists "rates delete for signed-in people" on public.rates;
create policy "rates delete for signed-in people" on public.rates for delete to authenticated using (true);

alter table public.decisions enable row level security;
drop policy if exists "decisions select for signed-in people" on public.decisions;
create policy "decisions select for signed-in people" on public.decisions for select to authenticated using (true);
drop policy if exists "decisions insert for signed-in people" on public.decisions;
create policy "decisions insert for signed-in people" on public.decisions for insert to authenticated with check (true);
drop policy if exists "decisions update for signed-in people" on public.decisions;
create policy "decisions update for signed-in people" on public.decisions for update to authenticated using (true) with check (true);
drop policy if exists "decisions delete for signed-in people" on public.decisions;
create policy "decisions delete for signed-in people" on public.decisions for delete to authenticated using (true);

-- Live updates: other browsers see changes without reloading.
do $$
declare
  t text;
begin
  foreach t in array array['facilities', 'greenhouses', 'cultivations', 'value_edits', 'entered_rows', 'climate_readings', 'fruit_types', 'rates', 'decisions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
