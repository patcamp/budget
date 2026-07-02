# supabase/

`schema.sql` is the single source of truth for the database — there is no migration tool or version history. It is run by hand, once, in the Supabase SQL Editor. If you change the schema, edit this file (additively — don't rewrite past statements that already ran in production) and tell the user the exact new statements to run in their Supabase dashboard.

## Tables

All data tables carry a `user_id uuid not null default auth.uid()` ownership column (added by the 2026-07 multi-user migration) — inserts never need to send it explicitly.

- `profiles` — one row per auth user (PK references `auth.users`): email, `full_name`, `company`. Created automatically by the `on_auth_user_created` trigger, which copies `full_name`/`company` out of the signup metadata (`raw_user_meta_data`).
- `pay_periods` — one row per pay cycle: dates, a snapshot of paycheck/gross/allocations amounts, `is_locked`/`locked_at`. The `allocations` column is JSONB (`{ name, type, amount }[]`) written by the Admin → Paycheck tab. `day_hours`/`night_hours` hold the actual hours worked that period for hourly users (null for salary users and pre-migration periods). Locking is a soft, reversible flag — enforced only in UI, not by RLS or any DB constraint.
- `categories` — budget categories with `budget_per_period`, `is_fixed`, `color`, `sort_order`, `archived`, `note`. `archived` is the soft-delete; there is no un-archive UI. Managed in-app via the Admin → Categories tab. Names are unique per user (`unique(user_id, name)`), not globally.
- `expenses` — transactions, FK to `pay_periods` and `categories`. The FK to `pay_periods` has no `ON DELETE CASCADE` — app code (`deletePayPeriodWithExpenses`) deletes child expenses first, then the period row. The FK to `categories` has no cascade either; category deletes are blocked in the UI when the category has expenses.
- `paycheck_config` — one row per user (enforced by RLS scoping + a `LIMIT 1` in the query, not a DB constraint). Stores `pay_type` ('salary'|'hourly'), salary fields, hourly fields (`hourly_rate`, `night_diff_type` 'flat'|'pct', `night_diff_value`, `default_day_hours`/`default_night_hours` per period), deduction rates, tax percentages, and the accounts JSONB array. Upserted by the Admin → Paycheck tab; first created by `setupNewUser()` onboarding (always salary-type).
- `investments` — portfolio holdings: ticker, account label, shares, cost per share. Prices are fetched live from Yahoo Finance, not stored here.

## category_spend view

Aggregates `expenses` by category and period. Defined here but **not currently queried by app code** — Dashboard computes the same totals client-side from raw expenses. Don't assume changing this view affects the running app. Recreated by the multi-user migration with `security_invoker = true` so it respects RLS (owner-rights views would bypass it).

## RLS

All tables have RLS enabled with owner-scoped policies: `using (auth.uid() = user_id) with check (auth.uid() = user_id)` (profiles uses `auth.uid() = id`). This is the real data-protection layer — the anon key without a session returns zero rows. The original permissive "allow all" policies are dropped by the multi-user migration section at the bottom of `schema.sql`; that section also documents the run-order for migrating an existing single-user database (create the trigger, add the user in the Auth dashboard, then backfill `user_id` and swap policies).
