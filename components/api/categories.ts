import { supabase } from "@/lib/supabase";

export interface AddCategoryPayload {
  name: string;
  budget_per_period: number;
  is_fixed: boolean;
  color: string;
  sort_order: number;
  note: string | null;
  archived: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  budget_per_period?: number;
  is_fixed?: boolean;
  color?: string;
  sort_order?: number;
  note?: string | null;
}

export async function addCategory(payload: AddCategoryPayload): Promise<string | null> {
  const { error } = await supabase.from("categories").insert(payload);
  return error?.message ?? null;
}

export async function updateCategory(id: string, payload: UpdateCategoryPayload): Promise<string | null> {
  const { error } = await supabase.from("categories").update(payload).eq("id", id);
  return error?.message ?? null;
}

export async function deleteCategory(id: string): Promise<string | null> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  return error?.message ?? null;
}
