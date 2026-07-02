import { supabase } from "@/lib/supabase";
import { PayPeriod, Category, Expense, PaycheckConfig, Investment, Profile } from "@/lib/types";

export interface PageData {
  payPeriods: PayPeriod[];
  categories: Category[];
  expenses: Expense[];
  paycheckConfig: PaycheckConfig | null;
  investments: Investment[];
  profile: Profile | null;
  error: string | null;
}

export async function loadPageData(): Promise<PageData> {
  const [periodsRes, categoriesRes, expensesRes, configRes, investmentsRes, profileRes] = await Promise.all([
    supabase.from("pay_periods").select("*").order("start_date", { ascending: true }),
    // archived: false — archived categories are the soft-delete; there is no un-archive UI.
    supabase.from("categories").select("*").eq("archived", false).order("sort_order", { ascending: true }),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    supabase.from("paycheck_config").select("*").limit(1).maybeSingle(),
    supabase.from("investments").select("*").order("created_at", { ascending: true }),
    // RLS scopes every query above to the signed-in user; profiles has one row per user.
    supabase.from("profiles").select("*").limit(1).maybeSingle(),
  ]);

  const firstError =
    periodsRes.error?.message ||
    categoriesRes.error?.message ||
    expensesRes.error?.message ||
    configRes.error?.message ||
    investmentsRes.error?.message ||
    profileRes.error?.message;

  if (firstError) {
    return {
      payPeriods: [],
      categories: [],
      expenses: [],
      paycheckConfig: null,
      investments: [],
      profile: null,
      error: firstError,
    };
  }

  return {
    payPeriods: periodsRes.data || [],
    categories: categoriesRes.data || [],
    expenses: expensesRes.data || [],
    paycheckConfig: configRes.data ?? null,
    investments: investmentsRes.data || [],
    profile: profileRes.data ?? null,
    error: null,
  };
}
