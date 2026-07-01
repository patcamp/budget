# Patrick's Budget — Pay-Period Tracker

Personal single-user budget dashboard. Tracks spending per semi-monthly pay period, with the ability to lock a period so historical data can't be accidentally edited.

Stack: **Next.js 14 (App Router) + TypeScript + Supabase + Recharts**, deployed on Vercel. No auth, no test suite, no ORM/migration tool — see sub-directory CLAUDE.md files for specifics.

## Commands

```bash
npm run dev     # local dev server, http://localhost:3000
npm run build
npm run start
npm run lint
```

## Environment

Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (see `.env.local.example`). The anon key is safe to expose client-side — access control is via Supabase Row Level Security, not key secrecy.

## Architecture

- `app/` — Next.js App Router entry point. `page.tsx` fetches all data on mount via `loadPageData()` and owns the top-level tab navigation (This Period / Overview / Investments / Admin). See [app/CLAUDE.md](app/CLAUDE.md).
- `components/api/` — all Supabase calls, no JSX. Each file owns one domain: `data.ts` (page load), `dashboard.ts` (lock/create period), `expenses.ts`, `investments.ts`, `periods.ts` (admin edit/delete), `categories.ts` (admin CRUD), `admin.ts` (paycheck config).
- `components/ui/` — all client components (`"use client"`), no direct Supabase imports. See [components/CLAUDE.md](components/CLAUDE.md).
- `lib/` — Supabase client singleton + TypeScript types mirroring the DB schema. See [lib/CLAUDE.md](lib/CLAUDE.md).
- `app/api/quotes/route.ts` — server-side route that proxies Yahoo Finance price lookups for the Investments tab (avoids CORS, keeps yahoo-finance2 server-only).
- `supabase/schema.sql` — full DB schema, seed data, and RLS policies, run manually in the Supabase SQL Editor (no migration tooling). See [supabase/CLAUDE.md](supabase/CLAUDE.md).

## Data flow

`app/page.tsx` calls `loadPageData()` on mount, which fires 5 parallel Supabase queries (`pay_periods`, `categories`, `expenses`, `paycheck_config`, `investments`) and returns them as a single object. All data is held in `useState` in `page.tsx` and passed as props to whichever tab is active. Any mutation anywhere in the tree calls `onRefresh` (wired to `loadAll`) to trigger a full refetch — no optimistic UI, no realtime subscriptions, no local cache patching.

## Conventions worth knowing before editing

- Styling is inline `style={{...}}` objects throughout — no CSS modules/Tailwind (Tailwind is not installed). Dark theme palette: `#080B12` page bg, `#0F1825` panels, `#1E293B` borders, `#3B82F6`/category `color` accents.
- Money values are stored as `numeric(10,2)` in Postgres but arrive as strings over the JS client in some paths — always wrap reads in `Number(...)` before arithmetic.
- Schema changes require manually re-running SQL in the Supabase dashboard; document new SQL inline in `supabase/schema.sql`.
- `components/api/` files must not import from each other (they're flat, single-domain). `components/ui/` files must not import `supabase` directly — all DB access goes through `components/api/`.
