import { supabase } from "@/lib/supabase";
import type { QuoteResult } from "@/app/api/quotes/route";

export type { QuoteResult };

export async function fetchQuotes(
  symbols: string[]
): Promise<{ data: Record<string, QuoteResult>; error: string | null }> {
  if (!symbols.length) return { data: {}, error: null };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: {}, error: "Not signed in" };

  const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return { data: {}, error: "Unauthorized" };
  if (!res.ok) return { data: {}, error: `Quotes failed (${res.status})` };

  const data = (await res.json()) as Record<string, QuoteResult>;
  return { data, error: null };
}
