import { supabase } from "@/lib/supabase";
import { PayPeriod, PaycheckConfig } from "@/lib/types";
import { hourlyGross, computeBreakdown, toAllocations } from "@/lib/paycheck";

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

export async function createPayPeriod(
  activePeriod: PayPeriod
): Promise<{ data: PayPeriod | null; error: string | null }> {
  const nextStart = new Date(activePeriod.end_date);
  nextStart.setDate(nextStart.getDate() + 1);
  const nextEnd = new Date(nextStart);
  // +13 not +14: the period spans 14 calendar days and the start day is already day 1.
  nextEnd.setDate(nextEnd.getDate() + 13);

  const { data, error } = await supabase
    .from("pay_periods")
    .insert({
      start_date: nextStart.toISOString().slice(0, 10),
      end_date: nextEnd.toISOString().slice(0, 10),
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

  return { data: data as PayPeriod | null, error: error?.message ?? null };
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
