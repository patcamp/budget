# app/

Next.js App Router root. Minimal by design — no server components, no server actions.

## Files

- `layout.tsx` — root HTML shell + `<head>` metadata. No providers.
- `globals.css` — resets **plus the app's entire responsive/mobile layer**. Component styling stays inline, but inline styles can't express media queries, scrollbar styling, or `::before` content, so those live here as shared classes (single `720px` breakpoint throughout):
  - `.header-tab` / `.header-user` — top nav: one row on desktop; on mobile tabs are hidden (`display: none !important`) and the name/sign-out block becomes a full-width row. Tab chrome (padding, active underline, colors) lives on `.header-tab` in CSS — do not put `display`/`borderBottom`/`color` inline on the Links or mobile hide loses to specificity. Bottom tab bar is `.bottom-nav` (fixed, thumb zone).
  - `.metric-grid` / `.metric-card` / `.metric-card-sub` — This Period summary strip: forced 3 equal columns + reserved sub-line height so Spent's exact-cents row doesn't break the grid.
  - `.expense-sheet` / `.expense-sheet-body` / `.expense-sheet-actions` — mobile add-expense bottom sheet: scrollable fields + sticky opaque action bar so the submit button doesn't visually merge with iOS keyboard chrome.
  - `.paycheck-grid` — Admin Paycheck two-column → stacked on mobile. Children get `min-width: 0` because grid items default to `min-width: auto`, which would let a wide table force the column past the viewport instead of scrolling.
  - `.scroll-x` + `.scroll-x-content` — horizontal-scroll wrapper for tables that outgrow narrow viewports (used by InvestmentPanel and AdminPanel). Trailing padding goes on the inner `.scroll-x-content`, not `.scroll-x` — browsers collapse an overflow container's own end-side padding.
  - `.admin-table-header` / `.admin-row` + `.periods-columns`/`.categories-columns`/`.*-edit-columns` — Admin tables render as grid rows on desktop and stacked "label: value" cards on mobile; cells opt into the mobile label via a `data-label` attribute (cells without it render unlabeled).
- `(app)/` — route group (adds no URL segment) holding the 4 tabs as real routes, plus the shared layout that fetches data for all of them:
  - `(app)/layout.tsx` — the only data-fetching entry point, gated on a Supabase Auth session (`getSession()` on mount + `onAuthChange` subscription; `authReady` state prevents an AuthScreen flash while localStorage is checked). No session → renders `AuthScreen`. With a session it calls `loadPageData()` (from `components/api/data.ts`), which fires 7 parallel Supabase queries and returns a typed `PageData` object; if config/categories/periods are incomplete it runs idempotent `setupNewUser()` and refetches. A `loadGen` ref drops stale in-flight loads after sign-out or user switch. Holds all data in `useState` and exposes it — plus `loadAll` as `onRefresh` — through a `BudgetDataContext` / `useBudgetData()` hook so every route page can read it without its own fetch. Renders the tab nav (`<Link>`s to `/`, `/overview`, `/investments`, `/admin`, active state via `usePathname()`) plus the display-name/sign-out header (a `flexWrap` row using the `.header-tab`/`.header-user` classes from `globals.css` so it reflows on mobile), then `{children}`. Signing out clears all data state.
  - `(app)/page.tsx` ("This Period", route `/`), `(app)/overview/page.tsx` (`/overview`), `(app)/investments/page.tsx` (`/investments`), `(app)/admin/page.tsx` (`/admin`) — thin route pages. Each calls `useBudgetData()` and renders the corresponding tab component (`Dashboard`, `Overview`, `InvestmentPanel`, `AdminPanel`). `page.tsx` and `overview/page.tsx` own URL-query-param sync for their filters (see below) and canonicalize stale/invalid ids via `router.replace`.
- `api/quotes/route.ts` — server-side API route that accepts `?symbols=VOO,AAPL,...` and returns live price data via `yahoo-finance2`. Requires a Bearer access token (validated with Supabase `getUser`), caps at 20 symbols, and sets `ok: false` on lookup failure. Client calls go through `components/api/quotes.ts`. Uses `new YahooFinanceClass()` (v3). Passes `validateResult: false` because mutual funds like FXAIX don't match the strict quote schema.

## URL query-param filters

- `(app)/page.tsx` reads/writes `?period=<id>` (falls back to the most recent pay period when absent or referencing a period that no longer exists) and `?category=<id>` (falls back to `"all"` when absent or unknown), passed to `Dashboard` as controlled `selectedPeriodId`/`statementFilter` props. Invalid params are rewritten out of the URL.
- `(app)/overview/page.tsx` reads/writes `?periods=id1,id2,...` (falls back to *all* period ids when the param is absent entirely — an explicit empty selection, e.g. after deselecting everything, is represented as `?periods=` rather than omitting the param, so it isn't confused with "no filter set"), passed to `Overview` as a controlled `selectedIds` prop. Stale ids are stripped from the URL after deletes.
- Both use `router.replace` (not `push`) so adjusting a filter doesn't spam browser history — only real tab navigation (via `<Link>`) creates history entries.

## Things to preserve if you touch `(app)/layout.tsx`

- Loading and error states are handled here, not in child components — keep that split if you add new top-level queries.
- The error message surfaces the raw Supabase error plus a hint about missing env vars / unrun schema — don't replace it with a generic message; this is the most common failure mode for a fresh setup.
- All 7 queries run via `loadPageData()` in `components/api/data.ts`, not inline in this file. If you add a new table, add its query there.
- `useCallback` on `loadAll` is intentional — it's passed as a dep to `useEffect`, so without it every render would re-trigger the effect.
