import { supabase } from "@/lib/supabase";
import {
  PayPeriod,
  Category,
  Expense,
  PaycheckConfig,
  Investment,
  InvestmentPurchase,
  RecurringExpense,
  Profile,
} from "@/lib/types";

export interface PageData {
  payPeriods: PayPeriod[];
  categories: Category[];
  expenses: Expense[];
  paycheckConfig: PaycheckConfig | null;
  investments: Investment[];
  investmentPurchases: InvestmentPurchase[];
  recurringExpenses: RecurringExpense[];
  profile: Profile | null;
  error: string | null;
}

export async function loadPageData(): Promise<PageData> {
  const [
    periodsRes,
    categoriesRes,
    expensesRes,
    configRes,
    investmentsRes,
    purchasesRes,
    recurringRes,
    profileRes,
  ] = await Promise.all([
    supabase.from("pay_periods").select("*").order("start_date", { ascending: true }),
    // archived: false — archived categories are the soft-delete; there is no un-archive UI.
    supabase.from("categories").select("*").eq("archived", false).order("sort_order", { ascending: true }),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    supabase.from("paycheck_config").select("*").limit(1).maybeSingle(),
    supabase.from("investments").select("*").order("created_at", { ascending: true }),
    supabase.from("investment_purchases").select("*").order("purchased_at", { ascending: false }),
    supabase.from("recurring_expenses").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    // RLS scopes every query above to the signed-in user; profiles has one row per user.
    supabase.from("profiles").select("*").limit(1).maybeSingle(),
  ]);

  // Purchases & recurring tables are additive. Until their SQL is run in
  // Supabase, treat a missing-relation error as empty so the rest of the app
  // still loads; mutations will surface the real error.
  const purchasesMissing =
    !!purchasesRes.error &&
    /investment_purchases|does not exist|Could not find the table/i.test(purchasesRes.error.message);
  const purchasesError = purchasesMissing ? null : purchasesRes.error?.message;

  const recurringMissing =
    !!recurringRes.error &&
    /recurring_expenses|does not exist|Could not find the table/i.test(recurringRes.error.message);
  const recurringError = recurringMissing ? null : recurringRes.error?.message;

  const firstError =
    periodsRes.error?.message ||
    categoriesRes.error?.message ||
    expensesRes.error?.message ||
    configRes.error?.message ||
    investmentsRes.error?.message ||
    purchasesError ||
    recurringError ||
    profileRes.error?.message;

  if (firstError) {
    return {
      payPeriods: [],
      categories: [],
      expenses: [],
      paycheckConfig: null,
      investments: [],
      investmentPurchases: [],
      recurringExpenses: [],
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
    investmentPurchases: purchasesMissing ? [] : purchasesRes.data || [],
    recurringExpenses: recurringMissing ? [] : recurringRes.data || [],
    profile: profileRes.data ?? null,
    error: null,
  };
}
