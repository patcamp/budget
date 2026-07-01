import { supabase } from "@/lib/supabase";
import { Account } from "@/lib/types";

export interface PaycheckConfigPayload {
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
