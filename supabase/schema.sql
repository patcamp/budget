-- ============================================================
-- Patrick's Budget — Supabase Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- 1. PAY PERIODS
-- Each row = one biweekly/semi-monthly paycheck cycle.
-- "locked" = true means the period is closed out and actuals are final.
create table pay_periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  paycheck_amount numeric(10,2) not null default 1614.86,
  gross_amount numeric(10,2) not null default 4386.56,
  roth_401k numeric(10,2) not null default 745.72,
  brokerage_amount numeric(10,2) not null default 248.44,
  savings_amount numeric(10,2) not null default 621.10,
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  notes text
);

-- 2. CATEGORIES
-- Editable budget categories with target amounts per pay period.
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  budget_per_period numeric(10,2) not null default 0,
  is_fixed boolean not null default false,
  color text not null default '#3B82F6',
  sort_order int not null default 0,
  note text,
  archived boolean not null default false
);

-- 3. EXPENSES
-- Individual transactions logged against a pay period + category.
create table expenses (
  id uuid primary key default gen_random_uuid(),
  pay_period_id uuid not null references pay_periods(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  amount numeric(10,2) not null,
  description text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_expenses_pay_period on expenses(pay_period_id);
create index idx_expenses_category on expenses(category_id);

-- ============================================================
-- SEED DATA: your 13 starting categories from the dashboard
-- ============================================================
insert into categories (name, budget_per_period, is_fixed, color, sort_order, note) values
  ('Rent & Utilities',    450.00, true,  '#2563EB', 1,  'Venmo to roommate ~$900/mo split.'),
  ('Truck Loan',          261.03, true,  '#7C3AED', 2,  'Half of $522.06/mo. Balance ~$15,249 at 5.19%.'),
  ('Dining Out',          200.00, false, '#DC2626', 3,  'Biggest lever. Watch repeat spots: El Rey, Lucky Penny, Pungo.'),
  ('Groceries',           125.00, false, '#16A34A', 4,  'Sam''s Club + Trader Joe''s + Wegmans.'),
  ('Gas & Fuel',          125.00, false, '#D97706', 5,  'Tacoma + road trips to MD/NC push this up.'),
  ('Golf',                75.00,  false, '#0891B2', 6,  'Local VB rounds keep this reasonable.'),
  ('Auto (service/misc)', 40.00,  false, '#9F1239', 7,  'Oil changes, parts, car-related one-offs.'),
  ('Subscriptions',       27.50,  true,  '#6B7280', 8,  'Spotify, Apple, OpenAI, dental pre-tax.'),
  ('Entertainment',       37.50,  false, '#7C2D12', 9,  'Parks, events. Keep one-time big buys separate.'),
  ('Transportation',      30.00,  false, '#0D9488', 10, 'Uber, EZPass, parking.'),
  ('Shopping',            25.00,  false, '#BE185D', 11, 'Amazon, retail, misc.'),
  ('Personal Care',       15.00,  false, '#4338CA', 12, 'Haircuts, grooming.'),
  ('Car Wash',            8.00,   false, '#64748B', 13, 'Grand Slam Car Wash.');

-- ============================================================
-- SEED DATA: first pay period (July 7, 2026)
-- Semi-monthly Booz Allen cycle. Adjust end_date as needed.
-- ============================================================
insert into pay_periods (start_date, end_date, paycheck_amount, gross_amount, roth_401k, brokerage_amount, savings_amount, is_locked)
values ('2026-06-16', '2026-07-07', 1614.86, 4386.56, 745.72, 248.44, 621.10, false);

-- ============================================================
-- ROW LEVEL SECURITY
-- This is a personal single-user app. Simplest safe approach:
-- enable RLS but allow all operations for now since there's no
-- multi-user auth. If you add Supabase Auth later, replace these
-- permissive policies with auth.uid()-scoped ones.
-- ============================================================
alter table pay_periods enable row level security;
alter table categories enable row level security;
alter table expenses enable row level security;

create policy "Allow all on pay_periods" on pay_periods for all using (true) with check (true);
create policy "Allow all on categories" on categories for all using (true) with check (true);
create policy "Allow all on expenses" on expenses for all using (true) with check (true);

-- ============================================================
-- PAYCHECK CONFIG + PAY PERIOD ALLOCATIONS (Admin feature)
-- Run these statements in Supabase SQL Editor.
--
-- accounts JSONB shape: array of
--   { id: string, name: string, type: string, pct: number }
--   type 'pre_tax'  — % of gross, reduces taxable income (traditional 401k, FSA)
--   type 'post_tax' — % of gross, no tax benefit (Roth 401k)
--   type 'spending' — % of net take-home → paycheck_amount (checking)
--   type 'other'    — % of net take-home (savings, brokerage, etc.)
--   All 'spending' + 'other' pcts must sum to 100.
-- ============================================================
create table paycheck_config (
  id uuid primary key default gen_random_uuid(),
  annual_salary numeric(10,2) not null default 105277.44,
  pay_periods_per_year int not null default 24,
  -- Flat pre-tax deductions per period
  health_insurance_amount numeric(10,2) not null default 0.00,
  hsa_amount numeric(10,2) not null default 0.00,
  -- Tax rates (effective, as percentages 0–100)
  federal_tax_pct numeric(5,2) not null default 13.21,
  state_tax_pct numeric(5,2) not null default 5.50,
  fica_pct numeric(5,2) not null default 7.65,
  -- Dynamic accounts list
  accounts jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table paycheck_config enable row level security;
create policy "Allow all on paycheck_config" on paycheck_config for all using (true) with check (true);

-- Adds full allocation breakdown to each pay period (run separately if pay_periods exists).
alter table pay_periods add column if not exists allocations jsonb;

-- ============================================================
-- INVESTMENTS
-- Holdings tracker: one row per lot (ticker + account).
-- Run in Supabase SQL Editor to add the investments page.
-- ============================================================
create table investments (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  account text not null,
  shares numeric(12,6) not null default 0,
  cost_per_share numeric(10,4) not null default 0,
  created_at timestamptz not null default now()
);

alter table investments enable row level security;
create policy "Allow all on investments" on investments for all using (true) with check (true);

-- ============================================================
-- HELPER VIEW: spend per category per pay period
-- ============================================================
create view category_spend as
select
  e.pay_period_id,
  e.category_id,
  c.name as category_name,
  c.color,
  c.budget_per_period,
  c.is_fixed,
  c.sort_order,
  coalesce(sum(e.amount), 0) as actual_spent
from categories c
left join expenses e on e.category_id = c.id
where c.archived = false
group by e.pay_period_id, e.category_id, c.name, c.color, c.budget_per_period, c.is_fixed, c.sort_order;

-- ============================================================
-- MULTI-USER MIGRATION (2026-07-02)
-- Adds Supabase Auth support: profiles table, per-row user_id
-- ownership, and auth.uid()-scoped RLS replacing the old
-- permissive "allow all" policies.
--
-- RUN ORDER (important):
--   Step 1: run sections A + B below.
--   Step 2: in Dashboard > Authentication > Users > "Add user",
--           create patrickcampfield@gmail.com with "Auto Confirm
--           User" checked. (The trigger from section A creates
--           the profile row automatically.)
--   Step 3: run sections C + D + E below to backfill existing
--           rows to that user and lock down RLS.
--   Recommended: Dashboard > Authentication > Sign In / Up >
--           disable "Confirm email" so registration doesn't
--           require an email round-trip (the app handles both).
-- ============================================================

-- ── A. PROFILES ─────────────────────────────────────────────
-- One row per auth user; holds registration info (name, company).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Own profile" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row on signup. The register form passes
-- full_name/company via auth signUp metadata (raw_user_meta_data).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, company)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'company');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── B. ADD user_id OWNERSHIP COLUMNS ────────────────────────
-- default auth.uid(): the DB stamps ownership on insert, so
-- client insert code never needs to send user_id explicitly.
alter table pay_periods     add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table categories      add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table expenses        add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table paycheck_config add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table investments     add column user_id uuid references auth.users(id) on delete cascade default auth.uid();

-- ── C. BACKFILL EXISTING DATA TO PATRICK'S ACCOUNT ──────────
-- Run AFTER creating the patrickcampfield@gmail.com user (step 2).
update pay_periods     set user_id = (select id from auth.users where email = 'patrickcampfield@gmail.com') where user_id is null;
update categories      set user_id = (select id from auth.users where email = 'patrickcampfield@gmail.com') where user_id is null;
update expenses        set user_id = (select id from auth.users where email = 'patrickcampfield@gmail.com') where user_id is null;
update paycheck_config set user_id = (select id from auth.users where email = 'patrickcampfield@gmail.com') where user_id is null;
update investments     set user_id = (select id from auth.users where email = 'patrickcampfield@gmail.com') where user_id is null;

alter table pay_periods     alter column user_id set not null;
alter table categories      alter column user_id set not null;
alter table expenses        alter column user_id set not null;
alter table paycheck_config alter column user_id set not null;
alter table investments     alter column user_id set not null;

create index idx_pay_periods_user     on pay_periods(user_id);
create index idx_categories_user      on categories(user_id);
create index idx_expenses_user        on expenses(user_id);
create index idx_paycheck_config_user on paycheck_config(user_id);
create index idx_investments_user     on investments(user_id);

-- ── D. OWNER-SCOPED RLS (replaces the permissive policies) ──
-- After this runs, the anon key returns ZERO rows without a
-- valid session — this is the actual data protection layer.
drop policy "Allow all on pay_periods"     on pay_periods;
drop policy "Allow all on categories"      on categories;
drop policy "Allow all on expenses"        on expenses;
drop policy "Allow all on paycheck_config" on paycheck_config;
drop policy "Allow all on investments"     on investments;

create policy "Own rows" on pay_periods     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows" on categories      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows" on expenses        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows" on paycheck_config for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows" on investments     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── E. CONSTRAINT + VIEW FIXES ──────────────────────────────
-- Category names are now unique per user, not globally.
alter table categories drop constraint categories_name_key;
alter table categories add constraint categories_user_name_key unique (user_id, name);

-- Personal column defaults from the single-user era become neutral —
-- new rows always receive explicit values from the app anyway.
alter table pay_periods alter column paycheck_amount  set default 0;
alter table pay_periods alter column gross_amount     set default 0;
alter table pay_periods alter column roth_401k        set default 0;
alter table pay_periods alter column brokerage_amount set default 0;
alter table pay_periods alter column savings_amount   set default 0;
alter table paycheck_config alter column annual_salary set default 0;

-- Recreate category_spend with security_invoker so it respects
-- RLS (default views run as owner and would bypass it), and
-- expose user_id. Still unused by app code — kept for parity.
drop view category_spend;
create view category_spend with (security_invoker = true) as
select
  c.user_id,
  e.pay_period_id,
  e.category_id,
  c.name as category_name,
  c.color,
  c.budget_per_period,
  c.is_fixed,
  c.sort_order,
  coalesce(sum(e.amount), 0) as actual_spent
from categories c
left join expenses e on e.category_id = c.id
where c.archived = false
group by c.user_id, e.pay_period_id, e.category_id, c.name, c.color, c.budget_per_period, c.is_fixed, c.sort_order;

-- ============================================================
-- HOURLY PAY + NIGHT DIFFERENTIAL (2026-07-02)
-- Supports hourly users (e.g. nurses) alongside salaried ones.
-- Config holds the default schedule; each pay period stores its
-- ACTUAL day/night hours (editable on the This Period tab while
-- unlocked), so gross varies per period with extra shifts.
-- ============================================================
alter table paycheck_config add column pay_type text not null default 'salary' check (pay_type in ('salary','hourly'));
alter table paycheck_config add column hourly_rate numeric(10,2) not null default 0;
alter table paycheck_config add column night_diff_type text not null default 'flat' check (night_diff_type in ('flat','pct'));
alter table paycheck_config add column night_diff_value numeric(10,2) not null default 0; -- $/hr when 'flat', percent when 'pct'
alter table paycheck_config add column default_day_hours numeric(6,2) not null default 0;   -- per pay period
alter table paycheck_config add column default_night_hours numeric(6,2) not null default 0; -- per pay period

-- Actual hours worked in the period. Null on salary users' periods
-- and on hourly periods created before this migration.
alter table pay_periods add column day_hours numeric(6,2);
alter table pay_periods add column night_hours numeric(6,2);
