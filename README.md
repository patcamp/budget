# Patrick's Budget — Pay-Period Tracker

A live budget dashboard that tracks spending per Booz Allen pay period (semi-monthly), with the ability to lock a period once it's final so historical data doesn't get accidentally edited.

Stack: **Next.js (App Router) + TypeScript + Supabase + Recharts**, deployed on **Vercel**.

---

## 1. Set up Supabase (fresh project)

1. Go to [supabase.com](https://supabase.com) and create a free account / new project.
2. Pick a name (e.g. `patrick-budget`), a strong database password (save it somewhere), and the region closest to you (US East is fine for VA).
3. Wait ~2 minutes for provisioning.
4. In the left sidebar, go to **SQL Editor > New query**.
5. Open `supabase/schema.sql` from this project, paste the entire contents in, and click **Run**.
   - This creates 3 tables (`pay_periods`, `categories`, `expenses`), a helper view, seeds your 13 starting categories, and creates your first pay period (June 16 – July 7, 2026).
   - If you get an error about `gen_random_uuid()` not existing, run this first: `create extension if not exists pgcrypto;` then re-run the schema.
6. Go to **Project Settings (gear icon) > API**. You'll need two values:
   - **Project URL** → looks like `https://xxxxx.supabase.co`
   - **Project API keys > anon public** → a long string starting with `eyJ...`

---

## 2. Run locally

```bash
# unzip the project, then:
cd budget-app
npm install

# copy the env template and fill in your Supabase values
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your key...
```

Then:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the dashboard with your seeded categories and the first pay period.

---

## 3. Push to GitHub

```bash
cd budget-app
git init
git add .
git commit -m "Initial budget tracker"
gh repo create patrick-budget --private --source=. --push
# or manually: create a repo on github.com, then:
# git remote add origin https://github.com/YOUR_USERNAME/patrick-budget.git
# git branch -M main
# git push -u origin main
```

`.env.local` is already in `.gitignore` so your Supabase keys won't be committed. (The anon key is safe to expose publicly anyway since it's protected by Row Level Security, but no reason to commit it.)

---

## 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com), sign in with GitHub.
2. Click **New Project**, select your `patrick-budget` repo.
3. Before deploying, expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy**. Takes about a minute.
5. You'll get a URL like `patrick-budget.vercel.app` — bookmark it on your phone home screen for quick access.

Every time you `git push` to `main`, Vercel auto-redeploys.

---

## How it works

### Pay periods
Each pay period is a row in `pay_periods` with a start/end date and a snapshot of your paycheck numbers (gross, Roth 401K, brokerage split, savings split, take-home to checking). The dashboard shows a row of pill buttons at the top — one per period — so you can click between them.

**"+ New Pay Period"** creates the next period automatically, defaulting to 14 days after the current one ends. Edit the dates directly in Supabase's Table Editor if your semi-monthly cycle doesn't land on exact 14-day boundaries (Booz Allen's semi-monthly periods are usually 1st–15th and 16th–end of month, which varies between 13–16 days).

### Logging expenses
While a period is **unlocked**, use the "Add Expense" form to log purchases against a category as they happen — amount, category, optional description, date. They show up immediately in the statement, the category tile, and the bar chart.

### Statement
Below the "Add Expense" form, the **Statement** lists every transaction in the active period chronologically (newest first), grouped by day with a per-day subtotal, and filterable down to a single category. This is the place to scan or delete recent entries without hunting through the per-category tiles; deleting here behaves the same as deleting from a tile and is disabled once the period is locked.

### Overview tab
The **Overview** tab (next to "This Period" at the top of the page) switches to a read-only, multi-period view: pick which pay periods to include (presets for Last 3 / Last 6 / All Time, or toggle individual periods), and it shows averages for paycheck/actual spend/surplus, an income-vs-actual trend chart across the selected periods, and how often each category ran over budget. No editing happens here — it's for spotting trends across periods, not logging expenses.

### Locking a period
Once a pay period is over and you're confident the numbers are final, click **Lock This Period**. This:
- Sets `is_locked = true` and stamps `locked_at`
- Hides the "Add Expense" form for that period
- Disables the delete (×) button on existing expenses
- Marks the period with a 🔒 icon in the picker

You can always **Unlock to Edit** if you find a mistake later — it's not a one-way door, just a soft guard against accidental edits to historical data.

### Editing categories or budget targets
Categories live in the `categories` table in Supabase. To change a budget amount, rename a category, change its color, or add a new one, the fastest way for now is Supabase's **Table Editor** (Table Editor > categories > edit row, or insert a new row). A categories-management UI can be added later if you want it in-app.

---

## Project structure

```
budget-app/
├── app/
│   ├── layout.tsx          # root layout
│   ├── page.tsx            # data fetching, "This Period" / "Overview" tab toggle
│   └── globals.css
├── components/
│   ├── Dashboard.tsx        # "This Period" view: summary cards, statement, chart, lock controls
│   ├── Overview.tsx         # "Overview" view: multi-period averages, trend chart, read-only
│   ├── PayPeriodPicker.tsx  # single-period selector pills + "new period" button (Dashboard)
│   ├── PeriodFilter.tsx     # multi-period selector + presets (Overview)
│   ├── AddExpenseForm.tsx   # inline expense entry form
│   ├── Statement.tsx        # chronological, filterable transaction list for the active period
│   └── CategoryTile.tsx     # per-category card with expandable expense list
├── lib/
│   ├── supabase.ts          # Supabase client
│   └── types.ts             # shared TypeScript interfaces
├── supabase/
│   └── schema.sql           # full DB schema + seed data — run once in Supabase
├── .env.local.example
└── package.json
```

Each directory above also has its own `CLAUDE.md` with more detail on conventions and data flow — start there if you're making non-trivial changes.

---

## Notes / things you might want to extend later

- **Auth**: right now RLS policies allow all access (since it's just you, no login). If you ever want this accessible from multiple devices/people with separate logins, add Supabase Auth and tighten the RLS policies to scope by `auth.uid()`.
- **Category management UI**: editing budget targets currently requires the Supabase Table Editor. Could build a settings page in-app.
- **CSV import**: if you want to bulk-import a month of CC transactions instead of entering one by one, that's a good next feature — parse a CSV, map merchant names to categories, bulk insert.
- **Recurring fixed expenses**: Rent/Truck Loan/Subscriptions could auto-populate as expenses when a new pay period is created, since they're fixed every cycle.
