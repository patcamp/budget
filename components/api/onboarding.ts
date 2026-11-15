import { supabase } from "@/lib/supabase";
import { hourlyGross, computeBreakdown, toAllocations } from "@/lib/paycheck";
import { addDaysLocal, toLocalDateString } from "@/lib/dates";
import { Account } from "@/lib/types";

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
const DEFAULT_CHECKING: Account = { id: "d1", name: "Checking", type: "spending", pct: 100 };

// Pay info captured by the register form (rides along as signup metadata).
export interface OnboardingPayInfo {
  pay_type: "salary" | "hourly";
  annual_salary: number | null;
  hourly_rate: number | null;
  night_diff_value: number | null; // flat $/hr at registration
  default_day_hours: number | null;
  default_night_hours: number | null;
}

function isUniqueViolation(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("unique") || m.includes("already exists");
}

// Collapses concurrent setupNewUser calls (React Strict Mode double-mount,
// overlapping layout loads) onto one in-flight promise so we don't race
// inserts and then treat the loser's unique violation as a hard error.
let setupInFlight: Promise<string | null> | null = null;

// Seeds a brand-new account: starter categories, a paycheck_config
// built from the pay info given at registration, and a first 14-day
// pay period starting today. Idempotent — safe to call when any subset
// of those pieces already exists (partial failure recovery). user_id
// on every insert is stamped by the DB default auth.uid().
export async function setupNewUser(pay: OnboardingPayInfo): Promise<string | null> {
  if (setupInFlight) return setupInFlight;
  setupInFlight = runSetup(pay).finally(() => {
    setupInFlight = null;
  });
  return setupInFlight;
}

async function runSetup(pay: OnboardingPayInfo): Promise<string | null> {
  const isHourly = pay.pay_type === "hourly";
  const salary = pay.annual_salary && pay.annual_salary > 0 ? pay.annual_salary : 60000;
  const rate = pay.hourly_rate ?? 0;
  const diff = pay.night_diff_value ?? 0;
  const dayHours = pay.default_day_hours ?? 0;
  const nightHours = pay.default_night_hours ?? 0;

  const gross = isHourly
    ? hourlyGross(rate, "flat", diff, dayHours, nightHours)
    : salary / PERIODS_PER_YEAR;
  const breakdown = computeBreakdown(
    gross,
    { health_insurance_amount: 0, hsa_amount: 0, ...DEFAULT_TAXES },
    [DEFAULT_CHECKING]
  );

  // ── Categories ────────────────────────────────────────────────────────────
  const { count: catCount, error: catCountErr } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });
  if (catCountErr) return catCountErr.message;
  if (!catCount) {
    const { error: catErr } = await supabase.from("categories").insert(STARTER_CATEGORIES);
    if (catErr && !isUniqueViolation(catErr.message)) return catErr.message;
  }

  // ── Paycheck config ───────────────────────────────────────────────────────
  const { data: existingCfg, error: cfgReadErr } = await supabase
    .from("paycheck_config")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (cfgReadErr) return cfgReadErr.message;
  if (!existingCfg) {
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
      accounts: [DEFAULT_CHECKING],
      updated_at: new Date().toISOString(),
    });
    if (cfgErr && !isUniqueViolation(cfgErr.message)) return cfgErr.message;
  }

  // ── First pay period ──────────────────────────────────────────────────────
  const { count: periodCount, error: periodCountErr } = await supabase
    .from("pay_periods")
    .select("id", { count: "exact", head: true });
  if (periodCountErr) return periodCountErr.message;
  if (!periodCount) {
    const start = toLocalDateString();
    // +13 not +14: the period spans 14 calendar days and the start day is already day 1.
    const end = addDaysLocal(start, 13);
    const { error: ppErr } = await supabase.from("pay_periods").insert({
      start_date: start,
      end_date: end,
      gross_amount: Number(gross.toFixed(2)),
      paycheck_amount: Number(breakdown.spending.toFixed(2)),
      roth_401k: 0,
      brokerage_amount: 0,
      savings_amount: 0,
      allocations: toAllocations(breakdown),
      // Left null so this period still tracks the config's default schedule
      // until the user explicitly edits its hours on This Period.
      day_hours: null,
      night_hours: null,
      is_locked: false,
    });
    if (ppErr) return ppErr.message;
  }

  return null;
}
