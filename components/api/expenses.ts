import { supabase } from "@/lib/supabase";

export interface AddExpensePayload {
  pay_period_id: string;
  category_id: string;
  amount: number;
  description: string | null;
  expense_date: string;
}

export async function addExpense(payload: AddExpensePayload): Promise<string | null> {
  const { error } = await supabase.from("expenses").insert(payload);
  return error?.message ?? null;
}

export async function deleteExpense(id: string): Promise<string | null> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  return error?.message ?? null;
}

export interface UpdateExpensePayload {
  category_id: string;
  amount: number;
  description: string | null;
  expense_date: string;
}

export async function updateExpense(id: string, payload: UpdateExpensePayload): Promise<string | null> {
  const { error } = await supabase.from("expenses").update(payload).eq("id", id);
  return error?.message ?? null;
}
