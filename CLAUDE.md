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

- `app/` — Next.js App Router entry point, fetches all data once on mount. See [app/CLAUDE.md](app/CLAUDE.md).
- `components/` — all UI, all client components (`"use client"`). State and most Supabase writes live in `Dashboard.tsx`. See [components/CLAUDE.md](components/CLAUDE.md).
- `lib/` — Supabase client singleton + TypeScript types mirroring the DB schema. See [lib/CLAUDE.md](lib/CLAUDE.md).
- `supabase/schema.sql` — full DB schema, seed data, and RLS policies, run manually in the Supabase SQL Editor (no migration tooling). See [supabase/CLAUDE.md](supabase/CLAUDE.md).

## Data flow

`app/page.tsx` loads `pay_periods`, `categories`, `expenses` in parallel on mount and passes them down as props to `Dashboard`. There is no global state manager — `Dashboard` derives everything (selected period, per-category spend totals, chart data) with `useMemo`, and any mutation (add/delete expense, lock/unlock period, create period) calls Supabase directly then invokes `onRefresh` to refetch from `app/page.tsx`. There is no optimistic UI and no realtime subscriptions.

## Conventions worth knowing before editing

- Styling is inline `style={{...}}` objects throughout — no CSS modules/Tailwind for component styling (Tailwind is not installed). Stay consistent with the existing dark theme palette (`#0F1825` panels, `#1E293B` borders, `#3B82F6`/category `color` accents) rather than introducing a new styling approach.
- Money values are stored as `numeric(10,2)` in Postgres but arrive as strings over the JS client in some paths — existing code wraps reads in `Number(...)` before arithmetic. Keep doing this.
- Schema changes require manually re-running SQL in the Supabase dashboard; there's no CLI/migration history, so document new SQL inline in `supabase/schema.sql` and tell the user to re-run it.
