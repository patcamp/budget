import { supabase } from "@/lib/supabase";
import { PayPeriod } from "@/lib/types";

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
      is_locked: false,
    })
    .select()
    .single();

  return { data: data as PayPeriod | null, error: error?.message ?? null };
}
