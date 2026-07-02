# lib/

- `supabase.ts` — single exported `supabase` client instance (`createClient` from `@supabase/supabase-js`), built from `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Imported only by `components/api/` files — UI components must not import it directly.
- `paycheck.ts` — pure paycheck math, no Supabase: `hourlyGross`/`nightRate` (hourly pay with flat-$ or % night differential), `computeBreakdown` (gross → pre-tax → taxes → post-tax → net split across accounts), `toAllocations` (breakdown → the allocations JSONB shape). Shared by AdminPanel's config preview/save and the Dashboard hours editor — change paycheck math here, not in components.
- `types.ts` — TypeScript interfaces for every DB table and shared shape. Must stay in exact sync with `supabase/schema.sql` column-for-column (names, nullability) — there's no codegen, so if you change the schema, update both files by hand.

Key types:
- `Profile` — mirrors the `profiles` table (id = auth user id, email, full_name, company)
- All 5 data-table types carry `user_id: string` (stamped by the DB `default auth.uid()`, never sent in insert payloads)
- `PayPeriod` — includes `allocations: { name, type, amount }[] | null` (JSONB), populated by the paycheck config calculator, and `day_hours`/`night_hours` (null for salary users)
- `Category` — includes `archived`, `sort_order`, and `note`; `archived` is the soft-delete flag
- `PaycheckConfig` — stores salary, deduction, and tax-rate fields; the `accounts` field is a JSONB array of `Account` objects
- `Investment` — ticker, account label, shares, cost_per_share
- `CategorySpend` — mirrors the `category_spend` SQL view, but nothing currently queries that view; per-category totals are computed client-side from raw expenses. Don't assume the view is wired up.
