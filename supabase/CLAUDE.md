# supabase/

`schema.sql` is the single source of truth for the database — there is no migration tool or version history. It is run by hand, once, in the Supabase SQL Editor. If you change the schema, edit this file (additively — don't rewrite past statements that already ran in production) and tell the user the exact new statements to run in their dashboard.

## Tables

- `pay_periods` — one row per pay cycle: dates, a snapshot of paycheck/401k/brokerage/savings amounts, `is_locked`/`locked_at`. Locking is a soft, reversible flag — not enforced by RLS or any DB constraint, purely a UI gate (see `components/CLAUDE.md`).
- `categories` — budget categories with `budget_per_period`, `is_fixed`, `color`, `sort_order`, `archived`. There is no in-app UI to edit these; the README directs users to Supabase's Table Editor instead.
- `expenses` — transactions, FK to both `pay_periods` (cascade delete) and `categories` (restrict delete — a category with logged expenses can't be deleted, only archived).

## category_spend view

Aggregates `expenses` by category/period. Defined here but **not currently queried by any app code** — `Dashboard.tsx` computes the same aggregation client-side from raw `expenses`. Don't assume changing this view affects the running app; if you want the app to use it, you'd need to add a query for it in `app/page.tsx`.

## RLS

All three tables have RLS enabled with permissive "allow all" policies (`using (true) with check (true)`) — this is intentional for a single-user app with no auth, not an oversight. If auth is ever added, these policies need to be replaced with `auth.uid()`-scoped ones; don't add a feature that assumes per-user data isolation without doing that first.
