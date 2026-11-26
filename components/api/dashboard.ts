import { supabase } from "@/lib/supabase";
import { PayPeriod, PaycheckConfig, RecurringExpense } from "@/lib/types";
import { hourlyGross, computeBreakdown, toAllocations } from "@/lib/paycheck";
import { addDaysLocal, clampDateLocal, toLocalDateString } from "@/lib/dates";

export async function togglePeriodLock(id: string, isLocked: boolean): Promise<string | null> {
  const { error } = await supabase
    .from("pay_periods")
    .update({
      is_locked: isLocked,
      locked_at: isLocked ? new Date().toISOString() : null,
    })
    .eq("id", id);
  return error?.message ?? null;
}

export interface CreatePayPeriodResult {
  data: PayPeriod | null;
  insertedRecurringCount: number;
  error: string | null;
  recurringError: string | null;
}

async function insertRecurringForPeriod(
  period: PayPeriod,
  recurringExpenses: RecurringExpense[],
  validCategoryIds?: Set<string>
): Promise<{ count: number; error: string | null }> {
  const rows = recurringExpenses
    .filter((t) => t.active && Number(t.amount) > 0 && (!validCategoryIds || validCategoryIds.has(t.category_id)))
    .map((t) => {
      const offset = Math.max(0, Math.floor(Number(t.day_offset) || 0));
      const expenseDate = clampDateLocal(addDaysLocal(period.start_date, offset), period.start_date, period.end_date);
      return {
        pay_period_id: period.id,
        category_id: t.category_id,
        amount: Number(Number(t.amount).toFixed(2)),
        description: t.description.trim() || null,
        expense_date: expenseDate,
      };
    });

  if (rows.length === 0) return { count: 0, error: null };

  const { error } = await supabase.from("expenses").insert(rows);
  if (error) return { count: 0, error: error.message };
  return { count: rows.length, error: null };
}

export async function createPayPeriod(
  activePeriod: PayPeriod,
  recurringExpenses: RecurringExpense[] = [],
  validCategoryIds?: Set<string>
): Promise<CreatePayPeriodResult> {
  // Local calendar arithmetic — UTC toISOString().slice would shift dates
  // around DST and evening local time.
  const nextStart = addDaysLocal(activePeriod.end_date, 1);
  // +13 not +14: the period spans 14 calendar days and the start day is already day 1.
  const nextEnd = addDaysLocal(nextStart, 13);

  const { data, error } = await supabase
    .from("pay_periods")
    .insert({
      start_date: nextStart,
      end_date: nextEnd,
      paycheck_amount: activePeriod.paycheck_amount,
      gross_amount: activePeriod.gross_amount,
      roth_401k: activePeriod.roth_401k,
      brokerage_amount: activePeriod.brokerage_amount,
      savings_amount: activePeriod.savings_amount,
      allocations: activePeriod.allocations,
      day_hours: activePeriod.day_hours,
      night_hours: activePeriod.night_hours,
      is_locked: false,
    })
    .select()
    .single();

  if (error || !data) {
    return {
      data: null,
      insertedRecurringCount: 0,
      error: error?.message ?? "Failed to create pay period.",
      recurringError: null,
    };
  }

  const created = data as PayPeriod;
  const rec = await insertRecurringForPeriod(created, recurringExpenses, validCategoryIds);

  return {
    data: created,
    insertedRecurringCount: rec.count,
    error: null,
    recurringError: rec.error,
  };
}

/** Creates an initial 14-day period starting today when the user has zero pay periods. */
export async function createFirstPayPeriod(
  config: PaycheckConfig | null,
  recurringExpenses: RecurringExpense[] = [],
  validCategoryIds?: Set<string>
): Promise<CreatePayPeriodResult> {
  const start = toLocalDateString();
  const end = addDaysLocal(start, 13);

  let gross = 0;
  let spending = 0;
  let allocations: { name: string; type: string; amount: number }[] | null = null;

  if (config) {
    const isHourly = config.pay_type === "hourly";
    gross = isHourly
      ? hourlyGross(
          Number(config.hourly_rate),
          config.night_diff_type,
          Number(config.night_diff_value),
          Number(config.default_day_hours),
          Number(config.default_night_hours)
        )
      : Number(config.annual_salary) / Math.max(1, Number(config.pay_periods_per_year || 24));

    const breakdown = computeBreakdown(
      gross,
      {
        health_insurance_amount: Number(config.health_insurance_amount),
        hsa_amount: Number(config.hsa_amount),
        federal_tax_pct: Number(config.federal_tax_pct),
        state_tax_pct: Number(config.state_tax_pct),
        fica_pct: Number(config.fica_pct),
      },
      config.accounts ?? []
    );
    spending = breakdown.spending;
    allocations = toAllocations(breakdown);
  }

  const { data, error } = await supabase
    .from("pay_periods")
    .insert({
      start_date: start,
      end_date: end,
      gross_amount: Number(gross.toFixed(2)),
      paycheck_amount: Number(spending.toFixed(2)),
      roth_401k: 0,
      brokerage_amount: 0,
      savings_amount: 0,
      allocations,
      day_hours: null,
      night_hours: null,
      is_locked: false,
    })
    .select()
    .single();

  if (error || !data) {
    return {
      data: null,
      insertedRecurringCount: 0,
      error: error?.message ?? "Failed to create pay period.",
      recurringError: null,
    };
  }

  const created = data as PayPeriod;
  const rec = await insertRecurringForPeriod(created, recurringExpenses, validCategoryIds);

  return {
    data: created,
    insertedRecurringCount: rec.count,
    error: null,
    recurringError: rec.error,
  };
}

// Saves the actual hours worked in a period (hourly users only) and
// recomputes that period's gross/paycheck/allocations from the config's
// rate, night differential, and tax/account settings.
export async function updatePeriodHours(
  periodId: string,
  config: PaycheckConfig,
  dayHours: number,
  nightHours: number
): Promise<string | null> {
  const gross = hourlyGross(
    Number(config.hourly_rate),
    config.night_diff_type,
    Number(config.night_diff_value),
    dayHours,
    nightHours
  );
  const breakdown = computeBreakdown(
    gross,
    {
      health_insurance_amount: Number(config.health_insurance_amount),
      hsa_amount: Number(config.hsa_amount),
      federal_tax_pct: Number(config.federal_tax_pct),
      state_tax_pct: Number(config.state_tax_pct),
      fica_pct: Number(config.fica_pct),
    },
    config.accounts ?? []
  );
  const { error } = await supabase
    .from("pay_periods")
    .update({
      day_hours: dayHours,
      night_hours: nightHours,
      gross_amount: Number(gross.toFixed(2)),
      paycheck_amount: Number(breakdown.spending.toFixed(2)),
      allocations: toAllocations(breakdown),
    })
    .eq("id", periodId);
  return error?.message ?? null;
}
