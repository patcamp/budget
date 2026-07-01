# Patrick's Budget — Pay-Period Tracker

A live budget dashboard that tracks spending per Booz Allen pay period (semi-monthly), with the ability to lock a period once it's final so historical data doesn't get accidentally edited.

Stack: **Next.js (App Router) + TypeScript + Supabase + Recharts**, deployed on **Vercel**.

---

## 1. Set up Supabase (fresh project)

1. Go to [supabase.com](https://supabase.com) and create a free account / new project.
2. Pick a name (e.g. `patrick-budget`), a strong database password, and the region closest to you.
3. Wait ~2 minutes for provisioning.
4. In the left sidebar, go to **SQL Editor > New query**.
5. Open `supabase/schema.sql` from this project, paste the entire contents, and click **Run**.
   - This creates all tables (`pay_periods`, `categories`, `expenses`, `paycheck_config`, `investments`), a helper view, seeds your starting categories, and creates the first pay period.
   - If you get an error about `gen_random_uuid()`, run `create extension if not exists pgcrypto;` first.
6. Go to **Project Settings (gear icon) > API**. You'll need:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **Project API keys > anon public** → starts with `eyJ...`

---

## 2. Run locally

```bash
cd budget
npm install

cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your key...
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial budget tracker"
gh repo create patrick-budget --private --source=. --push
```

`.env.local` is in `.gitignore` — your keys won't be committed.

---

## 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com), sign in with GitHub.
2. Click **New Project**, select your `patrick-budget` repo.
3. Expand **Environment Variables** and add both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Click **Deploy**. Takes about a minute.
5. Bookmark the Vercel URL on your phone for quick access.

Every `git push` to `main` auto-redeploys.

---

## How it works

### Navigation tabs

The top bar has four tabs: **This Period**, **Overview**, **Investments**, and **Admin**. All data is fetched once on page load and shared across tabs — switching tabs never triggers a new DB query.

### This Period tab

The main view for day-to-day tracking. Shows the active pay period's paycheck, budget totals, actual spend, and surplus. While unlocked, use the **Add Expense** form to log purchases as they happen. The **Statement** below it lists every transaction grouped by date (newest first) with per-day subtotals and a category filter — you can delete entries here or from the category tiles. The **bar chart** shows actual vs. budget per category at a glance.

### Locking a period

Once a pay period ends and the numbers are final, click **Lock This Period**. This hides the Add Expense form, disables delete buttons, and marks the period with a lock icon in the picker. **Unlock to Edit** is always available — locking is a soft guard, not permanent.

**"+ New Pay Period"** creates the next period automatically (14 days after the current one ends), copying paycheck amounts from the current period.

### Overview tab

Read-only, multi-period analysis. Select which periods to include (Last 3 / Last 6 / All Time presets, or toggle individual ones) and see averages for paycheck/actual spend/surplus, an income-vs-actual trend chart, and how often each category ran over budget across the selected range.

### Investments tab

Track portfolio holdings by ticker and account. Enter shares and average cost per share; live prices are fetched from Yahoo Finance on load. Shows total invested, market value, gain/loss, and return — broken out by account and by individual holding.

Supported symbols: standard tickers (VOO, VTI, AAPL), mutual funds (FXAIX, VTSAX), crypto (BTC-USD), etc.

### Admin tab

Three sub-tabs:

- **Paycheck** — configure your salary, pre-tax deductions (health insurance, HSA, 401k), tax rates (federal, state, FICA), and how net pay is split across accounts (checking, savings, brokerage, Roth). Preview the full paycheck breakdown in real time, then apply it to all unlocked pay periods at once.
- **Pay Periods** — edit dates and amounts for any period, or delete a period (shows how many expenses will be removed before confirming).
- **Categories** — add, rename, recolor, and reorder budget categories. Delete is blocked if the category has any transactions; archive it instead.

---

## Project structure

```
budget/
├── app/
│   ├── api/quotes/route.ts   # server-side Yahoo Finance proxy
│   ├── layout.tsx
│   ├── page.tsx              # data fetch + 4-tab nav
│   └── globals.css
├── components/
│   ├── api/                  # all Supabase calls (no JSX)
│   │   ├── data.ts           # loadPageData() — 5 parallel queries
│   │   ├── dashboard.ts      # togglePeriodLock, createPayPeriod
│   │   ├── expenses.ts       # addExpense, deleteExpense
│   │   ├── investments.ts    # addInvestment, deleteInvestment
│   │   ├── periods.ts        # updatePayPeriod, deletePayPeriodWithExpenses
│   │   ├── categories.ts     # addCategory, updateCategory, deleteCategory
│   │   └── admin.ts          # upsertPaycheckConfig, applyConfigToOpenPeriods
│   └── ui/                   # all client components (no direct Supabase imports)
│       ├── Dashboard.tsx     # This Period view
│       ├── Overview.tsx      # multi-period analysis
│       ├── InvestmentPanel.tsx
│       ├── AdminPanel.tsx    # paycheck config + period/category management
│       ├── Statement.tsx     # chronological transaction list
│       ├── CategoryTile.tsx  # per-category spend card
│       ├── AddExpenseForm.tsx
│       ├── PayPeriodPicker.tsx
│       └── PeriodFilter.tsx
├── lib/
│   ├── supabase.ts           # Supabase client singleton
│   └── types.ts              # TypeScript interfaces (mirror schema.sql)
├── supabase/
│   └── schema.sql            # full DB schema + seed data — run once in Supabase
├── .env.local.example
└── package.json
```

Each directory has its own `CLAUDE.md` with conventions and data-flow details.

---

## Notes / things you might want to extend later

- **Auth**: RLS policies currently allow all access (single-user, no login). To support multiple users, add Supabase Auth and scope RLS policies to `auth.uid()`.
- **CSV import**: bulk-import transactions from a credit card statement — parse CSV, map merchants to categories, bulk insert.
- **Recurring fixed expenses**: auto-populate fixed expenses (rent, subscriptions) when a new pay period is created.
- **Mobile PWA**: the Vercel URL already works on mobile — adding a `manifest.json` and service worker would make it installable as a home-screen app.
