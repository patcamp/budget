import { supabase } from "@/lib/supabase";

export interface UpdatePayPeriodPayload {
  start_date: string;
  end_date: string;
  gross_amount: number;
  paycheck_amount: number;
}

export async function updatePayPeriod(id: string, payload: UpdatePayPeriodPayload): Promise<string | null> {
  const { error } = await supabase.from("pay_periods").update(payload).eq("id", id);
  return error?.message ?? null;
}

export async function deletePayPeriodWithExpenses(periodId: string): Promise<string | null> {
  // The FK on expenses.pay_period_id has ON DELETE CASCADE, so this one
  // atomic delete removes the period's expenses with it.
  const { error } = await supabase.from("pay_periods").delete().eq("id", periodId);
  return error?.message ?? null;
}
