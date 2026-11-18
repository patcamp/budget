# Patrick's Budget — Pay-Period Tracker

Multi-user budget dashboard. Tracks spending per semi-monthly pay period, with the ability to lock a period so historical data can't be accidentally edited. Users sign in with Supabase Auth (email/password); every table is scoped per-user by `auth.uid()` RLS policies — the database, not the UI, is the data-protection layer.

Stack: **Next.js 14 (App Router) + TypeScript + Supabase (incl. Supabase Auth) + Recharts**, deployed on Vercel. No ORM/migration tool; the only tests are vitest unit tests for the pure paycheck math in `lib/paycheck.ts` — see sub-directory CLAUDE.md files for specifics.

## Commands

```bash
npm run dev     # local dev server, http://localhost:3000
npm run build
npm run start
npm run lint
npm test        # vitest — currently covers lib/paycheck.ts only
```

## Environment

Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (see `.env.local.example`). The anon key is safe to expose client-side — access control is via Supabase Row Level Security, not key secrecy.

## Architecture

- `app/` — Next.js App Router entry point. `(app)/layout.tsx` fetches all data on mount via `loadPageData()` and owns the top-level tab navigation (This Period / Overview / Investments / Admin) as real routes (`/`, `/overview`, `/investments`, `/admin`). See [app/CLAUDE.md](app/CLAUDE.md).
- `components/api/` — all Supabase calls, no JSX. Each file owns one domain: `data.ts` (page load), `auth.ts` (sign in/up/out, session, profile), `onboarding.ts` (first-login seed for new accounts), `dashboard.ts` (lock/create period), `expenses.ts`, `investments.ts` (log buy / undo purchase / delete holding), `periods.ts` (admin edit/delete), `categories.ts` (admin CRUD), `admin.ts` (paycheck config).
- `components/ui/` — all client components (`"use client"`), no direct Supabase imports. See [components/CLAUDE.md](components/CLAUDE.md).
- `lib/` — Supabase client singleton + TypeScript types mirroring the DB schema. See [lib/CLAUDE.md](lib/CLAUDE.md).
- `app/api/quotes/route.ts` — server-side route that proxies Yahoo Finance price lookups for the Investments tab (avoids CORS, keeps yahoo-finance2 server-only).
- `supabase/schema.sql` — full DB schema, seed data, and RLS policies, run manually in the Supabase SQL Editor (no migration tooling). See [supabase/CLAUDE.md](supabase/CLAUDE.md).

## Auth & data flow

`app/(app)/layout.tsx` gates everything on a Supabase Auth session (`getSession()` + `onAuthChange`): no session renders `AuthScreen` (login/register), a session renders the tab UI with a sign-out header and `{children}` (the matched route page). The session lives in localStorage via supabase-js, so all data fetching stays client-side — no server components or middleware. RLS scopes every query/mutation to the signed-in user automatically; `user_id` columns default to `auth.uid()` so insert payloads never send it.

Once signed in, the layout calls `loadPageData()`, which fires 7 parallel Supabase queries (`pay_periods`, `categories`, `expenses`, `paycheck_config`, `investments`, `investment_purchases`, `profiles`) and returns them as a single object. If the account has no categories and no paycheck config (fresh registration), `setupNewUser()` seeds starter categories, a paycheck config from the salary captured at signup, and a first pay period, then refetches. All data is held in `useState` in the layout and exposed to route pages via a `useBudgetData()` context hook — each of `app/(app)/page.tsx`, `overview/page.tsx`, `investments/page.tsx`, `admin/page.tsx` reads what it needs and renders the corresponding tab component. Any mutation anywhere in the tree calls `onRefresh` (wired to `loadAll`) to trigger a full refetch — no optimistic UI, no realtime subscriptions, no local cache patching.

The This Period and Overview routes additionally sync their filter state to the URL query string (`?period=&category=` and `?periods=`, respectively) via `useSearchParams`/`router.replace`, so filters are shareable/bookmarkable and survive a refresh; both default sensibly (latest period + all categories; all periods selected) when the params are absent.

## Conventions worth knowing before editing

- Styling is inline `style={{...}}` objects — no CSS modules/Tailwind (Tailwind is not installed). The one exception is `app/globals.css`, which holds resets plus shared responsive classes (single `720px` mobile breakpoint) for what inline styles can't do: media queries, scrollbars, `::before` labels. Prefer plain readable CSS there over adding a styling library. Dark theme palette: `#080B12` page bg, `#0F1825` panels, `#1E293B` borders, `#3B82F6`/category `color` accents.
- No hardcoded user-specific data (names, employer, salary figures) anywhere in the UI — the app must work as a blank slate for any new registrant. Titles/company come from the `profiles` row; pay figures come from `paycheck_config`.
- Don't define React components inside another component's body — they get a new identity each render and React remounts them (focused inputs lose focus every keystroke). Hoist helpers to module scope (see `NumField` in `AdminPanel.tsx`).
- Money values are stored as `numeric(10,2)` in Postgres but arrive as strings over the JS client in some paths — always wrap reads in `Number(...)` before arithmetic.
- Schema changes require manually re-running SQL in the Supabase dashboard; document new SQL inline in `supabase/schema.sql`.
- `components/api/` files must not import from each other (they're flat, single-domain). `components/ui/` files must not import `supabase` directly — all DB access goes through `components/api/`.
