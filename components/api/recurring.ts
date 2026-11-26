import { supabase } from "@/lib/supabase";

export interface AddRecurringExpensePayload {
  category_id: string;
  description: string;
  amount: number;
  day_offset: number;
  active: boolean;
  sort_order: number;
}

export interface UpdateRecurringExpensePayload {
  category_id?: string;
  description?: string;
  amount?: number;
  day_offset?: number;
  active?: boolean;
  sort_order?: number;
}

export async function addRecurringExpense(payload: AddRecurringExpensePayload): Promise<string | null> {
  const { error } = await supabase.from("recurring_expenses").insert(payload);
  return error?.message ?? null;
}

export async function addRecurringExpensesBulk(payloads: AddRecurringExpensePayload[]): Promise<string | null> {
  if (payloads.length === 0) return null;
  const { error } = await supabase.from("recurring_expenses").insert(payloads);
  return error?.message ?? null;
}

export async function updateRecurringExpense(
  id: string,
  payload: UpdateRecurringExpensePayload
): Promise<string | null> {
  const { error } = await supabase.from("recurring_expenses").update(payload).eq("id", id);
  return error?.message ?? null;
}

export async function deleteRecurringExpense(id: string): Promise<string | null> {
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  return error?.message ?? null;
}
