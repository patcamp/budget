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
  // Must delete child expenses first — the FK on expenses.pay_period_id has no ON DELETE CASCADE.
  const { error: expErr } = await supabase.from("expenses").delete().eq("pay_period_id", periodId);
  if (expErr) return expErr.message;
  const { error } = await supabase.from("pay_periods").delete().eq("id", periodId);
  return error?.message ?? null;
}
