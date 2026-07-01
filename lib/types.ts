export type AccountType = "pre_tax" | "post_tax" | "spending" | "other";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  pct: number;
}

export interface PayPeriod {
  id: string;
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
}

export interface Category {
  id: string;
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
  pay_period_id: string;
  category_id: string;
  amount: number;
  description: string | null;
  expense_date: string;
  created_at: string;
}

export interface PaycheckConfig {
  id: string;
  annual_salary: number;
  pay_periods_per_year: number;
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
  ticker: string;
  account: string;
  shares: number;
  cost_per_share: number;
  created_at: string;
}

// Mirrors the category_spend SQL view, but nothing currently queries it —
// per-category totals are computed client-side from the raw expenses array.
export interface CategorySpend {
  pay_period_id: string | null;
  category_id: string;
  category_name: string;
  color: string;
  budget_per_period: number;
  is_fixed: boolean;
  sort_order: number;
  actual_spent: number;
}
