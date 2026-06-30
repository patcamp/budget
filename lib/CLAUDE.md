# lib/

- `supabase.ts` — single exported `supabase` client instance (`createClient` from `@supabase/supabase-js`), built from `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Imported directly wherever a query/mutation is needed (`app/page.tsx`, `Dashboard.tsx`, `AddExpenseForm.tsx`, `CategoryTile.tsx`) — there is no data-access wrapper layer or repository pattern. Keep new queries inline at the call site rather than adding an abstraction unless the duplication becomes a real problem.
- `types.ts` — `PayPeriod`, `Category`, `Expense`, `CategorySpend` interfaces. These must stay in exact sync with `supabase/schema.sql` column-for-column (names, nullability) since there's no codegen from the DB — if you alter the schema, update both files by hand.

Note: `CategorySpend` mirrors the `category_spend` SQL view, but nothing in the app currently queries that view — all per-category totals are computed client-side in `Dashboard.tsx` from the raw `expenses` array. Keep that in mind if you're tempted to assume the view is wired up.
