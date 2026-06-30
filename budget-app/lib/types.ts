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
