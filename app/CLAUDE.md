# app/

Next.js App Router root. Minimal by design — no server components, no server actions.

## Files

- `layout.tsx` — root HTML shell + `<head>` metadata. No providers.
- `globals.css` — global resets only; all component styling is inline.
- `page.tsx` — the only data-fetching entry point, gated on a Supabase Auth session (`getSession()` on mount + `onAuthChange` subscription; `authReady` state prevents an AuthScreen flash while localStorage is checked). No session → renders `AuthScreen`. With a session it calls `loadPageData()` (from `components/api/data.ts`), which fires 6 parallel Supabase queries and returns a typed `PageData` object; if the account has no categories and no paycheck config, it first runs `setupNewUser()` (onboarding seed) and refetches. Holds all data in `useState` and owns `loadAll` as the shared `onRefresh` callback passed to every tab. Owns the 4-tab navigation toggle (`"period" | "overview" | "investments" | "admin"`) plus the display-name/sign-out header, rendering one of: `Dashboard`, `Overview`, `InvestmentPanel`, or `AdminPanel`. Signing out clears all data state.
- `api/quotes/route.ts` — server-side API route that accepts `?symbols=VOO,AAPL,...` and returns live price data via `yahoo-finance2`. Must be server-side to avoid CORS issues with Yahoo Finance. Uses `new YahooFinanceClass()` (v3 breaking change — the old singleton export was removed). Passes `validateResult: false` because mutual funds like FXAIX don't match the strict quote schema.

## Things to preserve if you touch `page.tsx`

- Loading and error states are handled here, not in child components — keep that split if you add new top-level queries.
- The error message surfaces the raw Supabase error plus a hint about missing env vars / unrun schema — don't replace it with a generic message; this is the most common failure mode for a fresh setup.
- All 6 queries run via `loadPageData()` in `components/api/data.ts`, not inline in this file. If you add a new table, add its query there.
- `useCallback` on `loadAll` is intentional — it's passed as a dep to `useEffect`, so without it every render would re-trigger the effect.
