import { supabase } from "@/lib/supabase";

export interface AddInvestmentPayload {
  ticker: string;
  account: string;
  shares: number;
  cost_per_share: number;
}

export async function addInvestment(payload: AddInvestmentPayload): Promise<string | null> {
  const { error } = await supabase.from("investments").insert(payload);
  return error?.message ?? null;
}

export async function updateInvestmentPosition(
  id: string,
  shares: number,
  cost_per_share: number
): Promise<string | null> {
  const { error } = await supabase.from("investments").update({ shares, cost_per_share }).eq("id", id);
  return error?.message ?? null;
}

export async function deleteInvestment(id: string): Promise<string | null> {
  const { error } = await supabase.from("investments").delete().eq("id", id);
  return error?.message ?? null;
}
