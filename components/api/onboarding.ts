import { supabase } from "@/lib/supabase";
import { hourlyGross } from "@/lib/paycheck";

// Neutral starter categories for brand-new accounts (not Patrick's
// personal seed set from schema.sql).
const STARTER_CATEGORIES = [
  { name: "Rent & Utilities", budget_per_period: 0, is_fixed: true, color: "#2563EB", sort_order: 1, note: null, archived: false },
  { name: "Groceries", budget_per_period: 0, is_fixed: false, color: "#16A34A", sort_order: 2, note: null, archived: false },
  { name: "Dining Out", budget_per_period: 0, is_fixed: false, color: "#DC2626", sort_order: 3, note: null, archived: false },
  { name: "Gas & Fuel", budget_per_period: 0, is_fixed: false, color: "#D97706", sort_order: 4, note: null, archived: false },
  { name: "Subscriptions", budget_per_period: 0, is_fixed: true, color: "#6B7280", sort_order: 5, note: null, archived: false },
  { name: "Entertainment", budget_per_period: 0, is_fixed: false, color: "#7C2D12", sort_order: 6, note: null, archived: false },
  { name: "Shopping", budget_per_period: 0, is_fixed: false, color: "#BE185D", sort_order: 7, note: null, archived: false },
];

const DEFAULT_TAXES = { federal_tax_pct: 12.0, state_tax_pct: 5.0, fica_pct: 7.65 };
const PERIODS_PER_YEAR = 24;

// Pay info captured by the register form (rides along as signup metadata).
export interface OnboardingPayInfo {
  pay_type: "salary" | "hourly";
  annual_salary: number | null;
  hourly_rate: number | null;
  night_diff_value: number | null; // flat $/hr at registration
  default_day_hours: number | null;
  default_night_hours: number | null;
}

// Seeds a brand-new account: starter categories, a paycheck_config
// built from the pay info given at registration, and a first 14-day
// pay period starting today. Called from page.tsx only when the
// user has no categories AND no paycheck_config, so it's safe to
// re-run (it just won't be invoked again). user_id on every insert
// is stamped by the DB default auth.uid().
export async function setupNewUser(pay: OnboardingPayInfo): Promise<string | null> {
  const isHourly = pay.pay_type === "hourly";
  const salary = pay.annual_salary && pay.annual_salary > 0 ? pay.annual_salary : 60000;
  const rate = pay.hourly_rate ?? 0;
  const diff = pay.night_diff_value ?? 0;
  const dayHours = pay.default_day_hours ?? 0;
  const nightHours = pay.default_night_hours ?? 0;

  const gross = isHourly
    ? hourlyGross(rate, "flat", diff, dayHours, nightHours)
    : salary / PERIODS_PER_YEAR;
  const taxRate = (DEFAULT_TAXES.federal_tax_pct + DEFAULT_TAXES.state_tax_pct + DEFAULT_TAXES.fica_pct) / 100;
  const net = gross * (1 - taxRate);

  const { error: catErr } = await supabase.from("categories").insert(STARTER_CATEGORIES);
  if (catErr) return catErr.message;

  const { error: cfgErr } = await supabase.from("paycheck_config").insert({
    pay_type: pay.pay_type,
    annual_salary: isHourly ? 0 : salary,
    pay_periods_per_year: PERIODS_PER_YEAR,
    hourly_rate: rate,
    night_diff_type: "flat",
    night_diff_value: diff,
    default_day_hours: dayHours,
    default_night_hours: nightHours,
    health_insurance_amount: 0,
    hsa_amount: 0,
    ...DEFAULT_TAXES,
    accounts: [{ id: "d1", name: "Checking", type: "spending", pct: 100 }],
    updated_at: new Date().toISOString(),
  });
  if (cfgErr) return cfgErr.message;

  const start = new Date();
  const end = new Date();
  // +13 not +14: the period spans 14 calendar days and the start day is already day 1.
  end.setDate(end.getDate() + 13);
  const { error: ppErr } = await supabase.from("pay_periods").insert({
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    gross_amount: Number(gross.toFixed(2)),
    paycheck_amount: Number(net.toFixed(2)),
    roth_401k: 0,
    brokerage_amount: 0,
    savings_amount: 0,
    allocations: [{ name: "Checking", type: "spending", amount: Number(net.toFixed(2)) }],
    day_hours: isHourly ? dayHours : null,
    night_hours: isHourly ? nightHours : null,
    is_locked: false,
  });
  return ppErr?.message ?? null;
}
