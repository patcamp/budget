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
