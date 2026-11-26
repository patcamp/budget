# supabase/

`schema.sql` is the single source of truth for the database — there is no migration tool or version history. It is run by hand, once, in the Supabase SQL Editor. If you change the schema, edit this file (additively — don't rewrite past statements that already ran in production) and tell the user the exact new statements to run in their Supabase dashboard.

## Tables

All data tables carry a `user_id uuid not null default auth.uid()` ownership column (added by the 2026-07 multi-user migration) — inserts never need to send it explicitly.

- `profiles` — one row per auth user (PK references `auth.users`): email, `full_name`, `company`. Created automatically by the `on_auth_user_created` trigger, which copies `full_name`/`company` out of the signup metadata (`raw_user_meta_data`).
- `pay_periods` — one row per pay cycle: dates, a snapshot of paycheck/gross/allocations amounts, `is_locked`/`locked_at`. The `allocations` column is JSONB (`{ name, type, amount }[]`) written by the Admin → Paycheck tab. `day_hours`/`night_hours` hold the actual hours worked that period for hourly users (null for salary users and pre-migration periods). Locking is reversible but **DB-enforced** (2026-07-05 hardening migration): `enforce_period_lock_on_periods` rejects updates/deletes on a locked row unless the write unlocks it, and `enforce_period_lock_on_expenses` rejects all writes to a locked period's expenses. Consequence: deleting an auth user who still has locked periods fails — unlock them first.
- `categories` — budget categories with `budget_per_period`, `is_fixed`, `color`, `sort_order`, `archived`, `note`. `archived` is the soft-delete; there is no un-archive UI. Managed in-app via the Admin → Categories tab. Names are unique per user (`unique(user_id, name)`), not globally.
- `expenses` — transactions, FK to `pay_periods` and `categories`. The FK to `pay_periods` has `ON DELETE CASCADE` (since the original schema; re-asserted by the 2026-07-05 migration), so deleting a period deletes its expenses in one statement — `deletePayPeriodWithExpenses` relies on this. The FK to `categories` is `ON DELETE RESTRICT`; category deletes are also blocked in the UI when the category has expenses. Same-owner is also DB-enforced (2026-11-15): `enforce_expense_ownership` rejects inserts/updates whose `pay_period_id` or `category_id` belongs to another user.
- `paycheck_config` — one row per user, enforced by a `unique (user_id)` constraint (added 2026-07-05). Stores `pay_type` ('salary'|'hourly'), salary fields, hourly fields (`hourly_rate`, `night_diff_type` 'flat'|'pct', `night_diff_value`, `default_day_hours`/`default_night_hours` per period), deduction rates, tax percentages, and the accounts JSONB array. Upserted by the Admin → Paycheck tab; first created by `setupNewUser()` onboarding.
- `investments` — portfolio holdings: ticker, account label, shares, cost per share. Unique per `(user_id, upper(ticker), account)` (2026-11-15). Prices are fetched live from Yahoo Finance, not stored here.
- `investment_purchases` — recurring buy log (2026-11-18): one row per contribution against a holding (`investment_id`, shares, price, amount, `purchased_at`, optional `pay_period_id`). Holdings stay the rolled-up position; deleting a purchase reverses it out of the holding. Cascade-deletes when the holding is removed.
- `recurring_expenses` — recurring/fixed expense templates (2026-11-26): `category_id` (FK to `categories` `on delete cascade`, same-owner trigger `enforce_recurring_expense_ownership`), `description`, `amount`, `day_offset` (0-indexed offset from period `start_date`), `active`, `sort_order`. When a new pay period is created, active templates are inserted as ordinary rows into `expenses`.
- `pay_periods` also has `unique (user_id, start_date)` (2026-11-15) to block duplicate/raced creates.

## category_spend view (dropped)

Was never queried by app code (Dashboard computes the same totals client-side from raw expenses), so the 2026-07-05 hardening migration drops it. The `security_invoker = true` definition remains in the file's history section if it's ever needed again — plain views run with owner rights and would bypass RLS.

## RLS

All tables have RLS enabled with owner-scoped policies: `using (auth.uid() = user_id) with check (auth.uid() = user_id)` (profiles uses `auth.uid() = id`). This is the real data-protection layer — the anon key without a session returns zero rows. The original permissive "allow all" policies are dropped by the multi-user migration section at the bottom of `schema.sql`; that section also documents the run-order for migrating an existing single-user database (create the trigger, add the user in the Auth dashboard, then backfill `user_id` and swap policies).
