# components/

Split into two subdirectories:

- `api/` — all Supabase calls. No JSX, no React imports. Each file owns one domain.
- `ui/` — all client components (`"use client"`). No direct `supabase` imports — all DB access goes through `api/`.

## api/ — Supabase action files

| File | What it owns |
|------|-------------|
| `data.ts` | `loadPageData()` — the single page-level fetch (5 parallel queries) |
| `dashboard.ts` | `togglePeriodLock`, `createPayPeriod` |
| `expenses.ts` | `addExpense`, `updateExpense`, `deleteExpense` |
| `investments.ts` | `addInvestment`, `updateInvestmentPosition`, `deleteInvestment` |
| `periods.ts` | `updatePayPeriod`, `deletePayPeriodWithExpenses` (deletes child expenses first — no DB cascade) |
| `categories.ts` | `addCategory`, `updateCategory`, `deleteCategory` |
| `admin.ts` | `upsertPaycheckConfig`, `applyConfigToOpenPeriods` (only updates unlocked periods) |

All functions return `string | null` (the error message) or a typed result object. None call each other.

## ui/ — Components

**`Dashboard.tsx`** is the hub for the "This Period" tab. Owns `selectedPeriodId`, `busy`, `statementOpen`, and `statementFilter` state. Derives `spendByCategory`, `totalBudget`, `totalActual`, `surplus`, and chart data via `useMemo`. Renders (in order): lock status bar, summary cards, `AddExpenseForm` (unlocked only), collapsible Statement card (header row holds the filter dropdown and collapse toggle), bar chart, category tile grid.

`statementFilter` lives in Dashboard rather than Statement so the category dropdown can sit in the Statement header bar alongside the collapse button — passing it as a controlled prop to Statement.

**`Statement.tsx`** renders the period's transactions grouped by date (newest first) with per-day subtotals. Supports a controlled mode (Dashboard passes `categoryFilter`/`onCategoryFilterChange`) and an uncontrolled standalone mode. In `noCard` mode (used inside Dashboard's unified card), it renders without its own outer wrapper or filter row. Each row (unlocked only) has an edit (✎) button that swaps the row for an inline form (category/amount/description/date + Save/Cancel), calling `updateExpense` then `onChanged`.

**`CategoryTile.tsx`** — per-category spend card with an expandable inline expense list. Progress bar is capped at 105% so it renders visibly "full" when over budget. Takes a `categories` prop (the full list, not just its own `category`) so the inline edit form can reassign an expense to a different category — same edit/save pattern as `Statement.tsx`, condensed for the tile's narrower width.

**`AddExpenseForm.tsx`** — owns its own form state, calls `addExpense`, then calls `onAdded` (→ `onRefresh`).

**`PayPeriodPicker.tsx`** — pure presentational period selector pills + "New Pay Period" button. No Supabase calls.

**`Overview.tsx`** — "Overview" tab. Read-only, no mutations. Owns `selectedIds` (initialized to all periods). Shows multi-period averages, income-vs-actual trend chart, and over-budget frequency per category, all computed client-side via `useMemo`.

**`PeriodFilter.tsx`** — multi-select period picker used by Overview. Toggle-based (vs. single-select in PayPeriodPicker). Preset buttons: Last 3 / Last 6 / All Time.

**`InvestmentPanel.tsx`** — "Investments" tab. Fetches live prices from `/api/quotes` on mount (and whenever the ticker list changes). Groups holdings by account. Uses `tickers.join(",")` as the `useEffect` dep to avoid infinite re-renders from array identity changes. Adding a holding that matches an existing row's ticker (case-insensitive) + account (trimmed, case-sensitive) merges into it — shares are summed and `cost_per_share` becomes the share-weighted average — instead of inserting a duplicate row.

**`AdminPanel.tsx`** — "Admin" tab with 3 sub-tabs:
- **Paycheck** — configure salary, deductions, tax rates, and account allocations; preview the paycheck breakdown; apply to all unlocked periods.
- **Pay Periods** — edit dates/amounts inline, delete (shows expense count before confirming).
- **Categories** — add, edit (name, color, budget, sort order), delete (blocked when the category has any transactions — checked client-side since all expenses are already in state).

## Data flow and mutation pattern

Reads flow down from `app/page.tsx`. Writes happen wherever the action lives (form, tile, panel) and always end with `onRefresh`/`onChanged`/`onAdded` → `loadAll()` in `page.tsx` for a full refetch. No local cache patching, no optimistic UI.

## Locking semantics

`locked` (derived from `activePeriod.is_locked`) is a client-side UI gate only — RLS allows all writes regardless. If you add a new mutation, check the `locked` prop and hide/disable the control, consistent with how `AddExpenseForm` and the delete buttons are gated.

## Styling

Inline `style` objects throughout. Reuse the existing palette:
- Page bg `#080B12`, panel bg `#0F1825`, borders `#1E293B`
- Text: primary `#F1F5F9`/`#E2E8F0`, secondary `#94A3B8`/`#64748B`, muted `#475569`/`#374151`
- Status: green `#4ADE80`/`#15803D` (good/locked), red `#F87171`/`#EF4444` (over budget), amber `#FBBF24` (open/in-progress)
- Category accent colors come from `category.color` (set per-row in DB), not hardcoded per component
