export type AccountType = "pre_tax" | "post_tax" | "spending" | "other";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  pct: number;
}

export interface Profile {
  id: string; // = auth.users id
  email: string;
  full_name: string | null;
  company: string | null;
  created_at: string;
  // One of the theme ids in lib/themes.ts; defaults to "dark" in the DB.
  theme: string;
}

export interface PayPeriod {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  paycheck_amount: number;
  gross_amount: number;
  roth_401k: number;
  brokerage_amount: number;
  savings_amount: number;
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
  notes: string | null;
  allocations: { name: string; type: string; amount: number }[] | null;
  // Actual hours worked this period — null for salary users and for
  // hourly periods created before the hourly migration.
  day_hours: number | null;
  night_hours: number | null;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  budget_per_period: number;
  is_fixed: boolean;
  color: string;
  sort_order: number;
  note: string | null;
  archived: boolean;
}

export interface Expense {
  id: string;
  user_id: string;
  pay_period_id: string;
  category_id: string;
  amount: number;
  description: string | null;
  expense_date: string;
  created_at: string;
}

export interface PaycheckConfig {
  id: string;
  user_id: string;
  pay_type: "salary" | "hourly";
  annual_salary: number;
  pay_periods_per_year: number;
  hourly_rate: number;
  night_diff_type: "flat" | "pct";
  night_diff_value: number; // $/hr when "flat", percent when "pct"
  default_day_hours: number; // per pay period
  default_night_hours: number;
  health_insurance_amount: number;
  hsa_amount: number;
  federal_tax_pct: number;
  state_tax_pct: number;
  fica_pct: number;
  accounts: Account[];
  updated_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  ticker: string;
  account: string;
  shares: number;
  cost_per_share: number;
  created_at: string;
}

/** One buy against a holding — source of recurring contribution history. */
export interface InvestmentPurchase {
  id: string;
  user_id: string;
  investment_id: string;
  pay_period_id: string | null;
  shares: number;
  price_per_share: number;
  amount: number;
  purchased_at: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
}

/** Per-period recurring/fixed expense template auto-inserted when creating a pay period. */
export interface RecurringExpense {
  id: string;
  user_id: string;
  category_id: string;
  description: string;
  amount: number;
  day_offset: number; // 0 = period start_date, clamped to period end_date
  active: boolean;
  sort_order: number;
  created_at: string;
}
