# components/

All client components (`"use client"`). No server components here. No shared component library — each file is self-contained with inline styles.

## Ownership / data flow

- `Dashboard.tsx` is the hub: owns `selectedPeriodId` and `busy` state, derives `spendByCategory`/`totalBudget`/`totalActual`/`surplus`/chart data via `useMemo`, and is the only place that mutates `pay_periods` (lock/unlock, create next period). It receives `payPeriods`/`categories`/`expenses`/`onRefresh` as props from `app/page.tsx` and passes filtered slices down.
- `PayPeriodPicker.tsx` — pure presentational period-selector pills + "+ New Pay Period" button. No Supabase calls; calls `onSelect`/`onCreateNext` props.
- `AddExpenseForm.tsx` — owns its own form state, inserts directly into `expenses` via Supabase, then calls `onAdded` (wired to `Dashboard`'s `onRefresh`) to trigger the parent refetch. Validates amount > 0 client-side only — no server-side validation beyond Postgres column types.
- `CategoryTile.tsx` — owns its own `expanded`/`deletingId` state, deletes directly from `expenses` via Supabase, then calls `onChanged`.
- `Overview.tsx` — the "Overview" tab (toggled in `app/page.tsx`, sibling to `Dashboard`). Read-only: no Supabase calls, no `onRefresh`, no lock logic. Takes the same `payPeriods`/`categories`/`expenses` props `app/page.tsx` already fetches and derives multi-period averages, a trend chart, and over-budget frequency per category entirely client-side via `useMemo`. Owns `selectedIds` (which periods are included), initialized to all periods.
- `PeriodFilter.tsx` — pure presentational multi-select period picker used by `Overview.tsx`. Mirrors `PayPeriodPicker.tsx`'s pill styling but toggles membership in an array instead of replacing a single selection, plus preset buttons (Last 3 / Last 6 / All Time). No Supabase calls.

So: **reads flow down from `app/page.tsx` through `Dashboard`; writes happen wherever the action is triggered (form, tile, dashboard) and always end with a call back up to `onRefresh`/`onChanged`/`onAdded` to refetch from source.** There is no local cache patching — every mutation causes a full three-query refetch. If you add a new mutation, follow this same pattern rather than introducing local state that could drift from the DB.

## Locking semantics

`locked` (derived from `activePeriod.is_locked`) is passed down to gate UI, not enforced server-side (RLS allows all operations — see `supabase/CLAUDE.md`). If you add a new mutation, check the `locked` prop and hide/disable the control client-side, consistent with how `AddExpenseForm` is hidden and the delete `×` is hidden in `CategoryTile` when locked.

## Styling

Inline `style` objects, dark theme. Reuse the existing palette rather than inventing new colors:
- Panel background `#0F1825`, page background `#080B12`, borders `#1E293B`
- Text: primary `#F1F5F9`/`#E2E8F0`, secondary `#94A3B8`/`#64748B`, muted `#475569`/`#374151`
- Status: green `#4ADE80`/`#15803D` (good/locked), red `#F87171`/`#EF4444` (over budget), amber `#FBBF24` (open/in-progress)
- Category accent colors come from `category.color` (set per-row in the DB), not hardcoded per component.
