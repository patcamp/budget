# supabase/

`schema.sql` is the single source of truth for the database — there is no migration tool or version history. It is run by hand, once, in the Supabase SQL Editor. If you change the schema, edit this file (additively — don't rewrite past statements that already ran in production) and tell the user the exact new statements to run in their Supabase dashboard.

## Tables

- `pay_periods` — one row per pay cycle: dates, a snapshot of paycheck/gross/allocations amounts, `is_locked`/`locked_at`. The `allocations` column is JSONB (`{ name, type, amount }[]`) written by the Admin → Paycheck tab. Locking is a soft, reversible flag — enforced only in UI, not by RLS or any DB constraint.
- `categories` — budget categories with `budget_per_period`, `is_fixed`, `color`, `sort_order`, `archived`, `note`. `archived` is the soft-delete; there is no un-archive UI. Managed in-app via the Admin → Categories tab.
- `expenses` — transactions, FK to `pay_periods` and `categories`. The FK to `pay_periods` has no `ON DELETE CASCADE` — app code (`deletePayPeriodWithExpenses`) deletes child expenses first, then the period row. The FK to `categories` has no cascade either; category deletes are blocked in the UI when the category has expenses.
- `paycheck_config` — single-row table (enforced by a `LIMIT 1` in the query, not a DB constraint). Stores salary, deduction rates, tax percentages, and the accounts JSONB array. Upserted by the Admin → Paycheck tab.
- `investments` — portfolio holdings: ticker, account label, shares, cost per share. Prices are fetched live from Yahoo Finance, not stored here.

## category_spend view

Aggregates `expenses` by category and period. Defined here but **not currently queried by app code** — Dashboard computes the same totals client-side from raw expenses. Don't assume changing this view affects the running app.

## RLS

All tables have RLS enabled with permissive "allow all" policies (`using (true) with check (true)`) — intentional for a single-user app with no auth. If auth is ever added, replace these with `auth.uid()`-scoped policies before shipping multi-user features.
