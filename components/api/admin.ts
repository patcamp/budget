import { supabase } from "@/lib/supabase";
import { Account } from "@/lib/types";
import { hourlyGross, computeBreakdown, toAllocations } from "@/lib/paycheck";

export interface PaycheckConfigPayload {
  pay_type: "salary" | "hourly";
  annual_salary: number;
  pay_periods_per_year: number;
  hourly_rate: number;
  night_diff_type: "flat" | "pct";
  night_diff_value: number;
  default_day_hours: number;
  default_night_hours: number;
  health_insurance_amount: number;
  hsa_amount: number;
  federal_tax_pct: number;
  state_tax_pct: number;
  fica_pct: number;
  accounts: Account[];
  updated_at: string;
}

export interface AllocationBreakdown {
  name: string;
  type: string;
  amount: number;
}

export async function upsertPaycheckConfig(
  configId: string | null,
  payload: PaycheckConfigPayload
): Promise<string | null> {
  const { error } = configId
    ? await supabase.from("paycheck_config").update(payload).eq("id", configId)
    : await supabase.from("paycheck_config").insert(payload);
  return error?.message ?? null;
}

export async function applyConfigToOpenPeriods(
  gross: number,
  spending: number,
  allocations: AllocationBreakdown[]
): Promise<string | null> {
  const { error } = await supabase
    .from("pay_periods")
    .update({
      gross_amount: Number(gross.toFixed(2)),
      paycheck_amount: Number(spending.toFixed(2)),
      allocations,
    })
    // Only unlocked periods are updated — locked periods preserve their historical amounts.
    .eq("is_locked", false);
  return error?.message ?? null;
}

// Hourly counterpart of applyConfigToOpenPeriods: each unlocked period
// keeps its own actual hours (falling back to the config defaults and
// backfilling them when null), so gross is recomputed per period rather
// than bulk-set to one value.
export async function applyHourlyConfigToOpenPeriods(payload: PaycheckConfigPayload): Promise<string | null> {
  const { data, error } = await supabase
    .from("pay_periods")
    .select("id, day_hours, night_hours")
    .eq("is_locked", false);
  if (error) return error.message;

  for (const p of data ?? []) {
    const dayHours = p.day_hours != null ? Number(p.day_hours) : payload.default_day_hours;
    const nightHours = p.night_hours != null ? Number(p.night_hours) : payload.default_night_hours;
    const gross = hourlyGross(payload.hourly_rate, payload.night_diff_type, payload.night_diff_value, dayHours, nightHours);
    const breakdown = computeBreakdown(gross, payload, payload.accounts);
    const { error: updateError } = await supabase
      .from("pay_periods")
      .update({
        day_hours: dayHours,
        night_hours: nightHours,
        gross_amount: Number(gross.toFixed(2)),
        paycheck_amount: Number(breakdown.spending.toFixed(2)),
        allocations: toAllocations(breakdown),
      })
      .eq("id", p.id);
    if (updateError) return updateError.message;
  }
  return null;
}
