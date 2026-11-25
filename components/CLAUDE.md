# components/

Split into two subdirectories:

- `api/` — all Supabase calls. No JSX, no React imports. Each file owns one domain.
- `ui/` — all client components (`"use client"`). No direct `supabase` imports — all DB access goes through `api/`.

## api/ — Supabase action files

| File | What it owns |
|------|-------------|
| `data.ts` | `loadPageData()` — the single page-level fetch (7 parallel queries, incl. `profiles` + `investment_purchases`) |
| `auth.ts` | `signIn`, `signUp` (passes name/company + pay info — pay_type, salary or hourly rate/diff/hours — as user metadata), `signOut`, `getSession`, `onAuthChange`, `getProfile`, `updateProfile`; re-exports `AuthSession` so UI never imports supabase-js types |
| `onboarding.ts` | `setupNewUser(pay)` — idempotent seed of starter categories, paycheck_config from registration metadata, and a first pay period (fills only what's missing; coalesces concurrent calls). Called from `(app)/layout.tsx` when config, categories, or periods are incomplete |
| `dashboard.ts` | `togglePeriodLock`, `createPayPeriod` (copies hours from the active period; local calendar dates via `lib/dates.ts`), `updatePeriodHours` (hourly users: saves a period's actual hours and recomputes its gross/paycheck/allocations via `lib/paycheck.ts`) |
| `expenses.ts` | `addExpense`, `updateExpense`, `deleteExpense` |
| `investments.ts` | `logInvestmentBuy`, `deleteInvestmentPurchase`, `deleteInvestment` |
| `quotes.ts` | `fetchQuotes(symbols)` — authenticated call to `/api/quotes` with the session Bearer token |
| `periods.ts` | `updatePayPeriod`, `deletePayPeriodWithExpenses` (single delete — the expenses FK has `ON DELETE CASCADE`) |
| `categories.ts` | `addCategory`, `updateCategory`, `deleteCategory` |
| `admin.ts` | `upsertPaycheckConfig`, `applyConfigToOpenPeriods` (salary: bulk-set, only unlocked periods), `applyHourlyConfigToOpenPeriods` (hourly: recomputes each unlocked period from its own day/night hours, falling back to config defaults only when hours are null — does not wipe custom hours) |

All functions return `string | null` (the error message) or a typed result object. None call each other.

## ui/ — Components

**`Dashboard.tsx`** is the hub for the "This Period" tab. `selectedPeriodId` and `statementFilter` are controlled props (owned by `app/(app)/page.tsx`, synced to `?period=`/`?category=` in the URL — see [app/CLAUDE.md](../app/CLAUDE.md)); `busy`, `statementOpen`, hours-editor, and the mobile add-expense sheet state stay local since they aren't shareable/bookmarkable filters. Derives `spendByCategory`, `totalBudget`, `totalActual`, `surplus`, and chart data via `useMemo`. Summary-card amounts are rounded to whole dollars (`fmt`), but the Spent card also shows the exact cent amount as a sub-line (`fmtExact`) — deliberate, user-requested; don't remove it when touching the cards. The three metric cards use the `.metric-grid` / `.metric-card` classes (always `repeat(3, minmax(0, 1fr))` so Spent's sub-line never wraps the card onto its own row on narrow phones). Renders (in order): surplus hero + lock, hours panel (hourly users only — shows the period's day/night hours + night rate, inline Edit → `updatePeriodHours`, gated by `locked`; periods with null hours display the config defaults), summary cards, `AddExpenseForm` (desktop inline; mobile FAB opens a bottom sheet with `layout="stacked"`), collapsible Statement card (header row holds the filter dropdown and collapse toggle), bar chart, category tile grid. Header title/company come from the `profile` prop; hours need the `paycheckConfig` prop.

`statementFilter` is threaded through Dashboard (not owned by Statement) so the category dropdown can sit in the Statement header bar alongside the collapse button — passed down as a controlled prop to Statement.

**`Statement.tsx`** renders the period's transactions grouped by date (newest first) with per-day subtotals. Supports a controlled mode (Dashboard passes `categoryFilter`/`onCategoryFilterChange`) and an uncontrolled standalone mode. In `noCard` mode (used inside Dashboard's unified card), it renders without its own outer wrapper or filter row. Each row (unlocked only) has an edit (✎) button that swaps the row for an inline form (category/amount/description/date + Save/Cancel), calling `updateExpense` then `onChanged`.

**`CategoryTile.tsx`** — per-category spend card with an expandable inline expense list. Progress bar is capped at 105% so it renders visibly "full" when over budget. Takes a `categories` prop (the full list, not just its own `category`) so the inline edit form can reassign an expense to a different category — same edit/save pattern as `Statement.tsx`, condensed for the tile's narrower width.

**`AddExpenseForm.tsx`** — controlled draft via `useExpenseDraft` (owned by `Dashboard` so the desktop inline form and mobile sheet share one state). Persists amount/description/category/date to `sessionStorage` through `lib/draftStorage.ts` so typed fields survive remounts when switching apps or tabs; clears the draft on successful submit. Calls `addExpense`, then `onAdded` (→ `onRefresh`).

**`PayPeriodPicker.tsx`** — pure presentational period selector pills + "New Pay Period" button. No Supabase calls.

**`Overview.tsx`** — "Overview" tab. Read-only, no mutations. `selectedIds` is a controlled prop (owned by `app/(app)/overview/page.tsx`, synced to `?periods=` in the URL, defaulting to all periods when absent — see [app/CLAUDE.md](../app/CLAUDE.md)). Shows multi-period averages, income-vs-actual trend chart, over-budget frequency per category, and a "Download CSV" export of the selected periods' transactions, all computed client-side via `useMemo`.

**`PeriodFilter.tsx`** — multi-select period picker used by Overview. Toggle-based (vs. single-select in PayPeriodPicker). Preset buttons: Last 3 / Last 6 / All Time.

**`InvestmentPanel.tsx`** — "Investments" tab. Layout mirrors Dashboard/Overview: gradient header, portfolio market-value hero (with Log a buy CTA), 3 metric cards (Invested / This Period / Return), optional account allocation bar, then holdings grouped by account. Primary action is **Log a buy** (by dollars or by shares) — the form is toggled from the hero (open by default when there are no holdings). Each buy appends an `investment_purchases` row and merges into the ticker+account holding (weighted avg cost). Prefills price from Yahoo when the ticker resolves; optional pay-period link defaults to the latest period. Holdings are expandable rows (purchase history + undo + remove holding live inside the expand) — one layout for mobile and desktop (narrow viewports hide Value/Return via `.invest-holding-row` in `globals.css`). Uses `tickers.join(",")` as the quotes `useEffect` dep to avoid infinite re-renders from array identity changes.

**`AdminPanel.tsx`** — "Admin" tab with 4 sub-tabs. Its form helpers (`NumField`, `SectionLabel`, `PreviewRow`) are defined at **module scope, not inside `AdminPanel`** — a component defined inside its parent's function body gets a new identity every render, so React remounts its DOM (and any focused `<input>` loses focus) on every keystroke. Keep any new helper components at module scope and pass `value`/`onChange` explicitly. The Paycheck layout uses the `.paycheck-grid` class and the Pay Periods/Categories tables use the `.admin-row`/`data-label` responsive pattern (both defined in `app/globals.css`). Sub-tabs:
- **Paycheck** — Salary/Hourly pay-type toggle. Salary mode: annual salary ÷ periods. Hourly mode: base rate, night differential (flat $ or % toggle), default day/night hours per period. Both share the deductions/tax/accounts panels and preview (math lives in `lib/paycheck.ts`); "Save & Apply" bulk-sets salary periods but recomputes hourly periods individually from their own hours.
- **Pay Periods** — edit dates/amounts inline, delete (shows expense count before confirming). Edit/Delete are disabled for locked periods (DB triggers would reject the write anyway) — unlock happens on the This Period tab.
- **Categories** — add, edit (name, color, budget, sort order), delete (blocked when the category has any transactions — checked client-side since all expenses are already in state).
- **Profile** — edit name/company (email read-only); saves via `updateProfile` in `api/auth.ts`.

**`AuthScreen.tsx`** — full-page login/register gate rendered by `page.tsx` when there's no session. Register collects name, company, email, password, and a Salary/Hourly pay-type toggle: salary shows an annual-salary field; hourly shows rate, flat $/hr night differential, and default day/night hours per period (all optional; % differentials are Admin-only). Pay info rides along as signup metadata and feeds `setupNewUser`. No callbacks — `page.tsx`'s `onAuthChange` subscription picks up the new session. Handles the "confirm your email" case when the Supabase project has email confirmation enabled.

## Data flow and mutation pattern

Reads flow down from `app/page.tsx`. Writes happen wherever the action lives (form, tile, panel) and always end with `onRefresh`/`onChanged`/`onAdded` → `loadAll()` in `page.tsx` for a full refetch. No local cache patching, no optimistic UI.

## Locking semantics

Locking is enforced at **two layers**. The database is the backstop: triggers (added in the 2026-07-05 hardening migration in `supabase/schema.sql`) reject any insert/update/delete on a locked period or its expenses — the only write a locked period accepts is the unlock itself. The UI layer is UX: `locked` (derived from `activePeriod.is_locked`) hides/disables mutation controls so users see a clean disabled state instead of a raw DB error. If you add a new mutation, still check the `locked` prop and gate the control (consistent with `AddExpenseForm` and the delete buttons); bulk updates against `pay_periods` must filter `.eq("is_locked", false)` or the trigger will fail the whole statement.

## Styling

Inline `style` objects for component styling; anything inline styles can't express (media queries, scrollbars, `::before` labels) lives as shared classes in `app/globals.css` — see [app/CLAUDE.md](../app/CLAUDE.md) for the class inventory. Mobile behavior uses a single `720px` breakpoint; wide tables get wrapped in `.scroll-x` > `.scroll-x-content` (InvestmentPanel and AdminPanel already do this) rather than being allowed to stretch the viewport.

Structural/UI colors (backgrounds, borders, text, accent) must use the CSS custom properties defined in `app/globals.css`, never hardcoded hex — the app supports 10 user-selectable themes (`lib/themes.ts`, applied via `data-theme` on `<html>`), and a hardcoded hex bypasses theming for whichever component has it:
- Backgrounds: `var(--bg-page)`, `var(--bg-panel)`, `var(--bg-panel-alt)` (selected/hover fill)
- Borders: `var(--border)`, `var(--border-soft)` (subtle dividers), `var(--border-strong)` (dashed CTAs, hover)
- Text: `var(--text)`/`var(--text-body)` (primary), `var(--text-secondary)`/`var(--text-muted)`, `var(--text-faint)` (least emphasis)
- Accent: `var(--accent)`, `var(--accent-strong)` (button fill), `var(--accent-text)` (text/icon color on an accent-filled button — do not assume white, some themes need dark text there)

Status colors are the one exception — kept as literal hex, constant across all themes, because they encode meaning (over-budget, locked, in-progress) rather than brand: green `#4ADE80`/`#15803D` (good/locked), red `#F87171`/`#EF4444` (over budget), amber `#FBBF24` (open/in-progress). Category accent colors come from `category.color` (set per-row in DB), not hardcoded per component, and are likewise never themed.
