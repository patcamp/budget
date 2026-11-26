# lib/

- `supabase.ts` — single exported `supabase` client instance (`createClient` from `@supabase/supabase-js`), built from `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Imported only by `components/api/` files — UI components must not import it directly.
- `dates.ts` — local-calendar helpers (`toLocalDateString`, `parseLocalDate`, `addDaysLocal`, `daysBetweenLocal`, `clampDateLocal`). Use these for any YYYY-MM-DD value — never `Date#toISOString().slice(0,10)`, which shifts the day around evening US time and DST.
- `pace.ts` — pure period pace math (`computePeriodPace` for daily safe-to-spend / remaining days / avg daily spent) and `matchesExpenseSearch` (statement search across description, category name, and amount). Covered by `pace.test.ts`.
- `csv.ts` — lightweight zero-dependency RFC-4180 CSV parser (`parseCsv`), header auto-detection (`guessColumnMapping`), date/amount parsers (`parseCsvDate`, `parseCsvAmount`), and row mapper (`mapCsvRowsToExpenses`) for client-side expense import. Covered by `csv.test.ts`.
- `draftStorage.ts` — tiny `sessionStorage` helpers (`readDraft` / `writeDraft` / `clearDraft`) for in-progress form drafts. Best-effort (swallows private-mode/quota errors); covered by `draftStorage.test.ts`.
- `paycheck.ts` — pure paycheck math, no Supabase: `hourlyGross`/`nightRate` (hourly pay with flat-$ or % night differential), `computeBreakdown` (gross → pre-tax → taxes → post-tax → net split across accounts), `toAllocations` (breakdown → the allocations JSONB shape). Shared by AdminPanel's config preview/save and the Dashboard hours editor — change paycheck math here, not in components.
- `paycheck.test.ts` / `dates.test.ts` / `pace.test.ts` / `csv.test.ts` / `draftStorage.test.ts` — vitest unit tests (`npm test`). Extend them when you touch the math, date, CSV, or search helpers.
- `types.ts` — TypeScript interfaces for every DB table and shared shape. Must stay in exact sync with `supabase/schema.sql` column-for-column (names, nullability) — there's no codegen, so if you change the schema, update both files by hand.

Key types:
- `Profile` — mirrors the `profiles` table (id = auth user id, email, full_name, company)
- All 5 data-table types carry `user_id: string` (stamped by the DB `default auth.uid()`, never sent in insert payloads)
- `PayPeriod` — includes `allocations: { name, type, amount }[] | null` (JSONB), populated by the paycheck config calculator, and `day_hours`/`night_hours` (null for salary users)
- `Category` — includes `archived`, `sort_order`, and `note`; `archived` is the soft-delete flag
- `PaycheckConfig` — stores salary, deduction, and tax-rate fields; the `accounts` field is a JSONB array of `Account` objects
- `Investment` — ticker, account label, shares, cost_per_share (rolled-up position)
- `InvestmentPurchase` — one buy against a holding (shares, price_per_share, amount, purchased_at, optional pay_period_id)
- `RecurringExpense` — per-period fixed/recurring expense template (category_id, description, amount, day_offset, active, sort_order) auto-inserted as normal expenses when creating a new pay period
