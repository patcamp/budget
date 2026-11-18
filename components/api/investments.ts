import { supabase } from "@/lib/supabase";

export interface LogBuyPayload {
  ticker: string;
  account: string;
  shares: number;
  price_per_share: number;
  purchased_at: string; // YYYY-MM-DD
  pay_period_id?: string | null;
  notes?: string | null;
}

/** Log a buy: merge into the ticker+account holding and append a purchase row. */
export async function logInvestmentBuy(payload: LogBuyPayload): Promise<string | null> {
  const ticker = payload.ticker.trim().toUpperCase();
  const account = payload.account.trim();
  const shares = Number(payload.shares);
  const price = Number(payload.price_per_share);
  const amount = Math.round(shares * price * 100) / 100;

  if (!ticker || !account) return "Ticker and account are required.";
  if (!(shares > 0)) return "Shares must be > 0.";
  if (!(price >= 0)) return "Price per share must be ≥ 0.";

  const { data: existing, error: findErr } = await supabase
    .from("investments")
    .select("id, shares, cost_per_share")
    .eq("account", account)
    .ilike("ticker", ticker)
    .maybeSingle();

  if (findErr) return findErr.message;

  let investmentId: string;

  if (existing) {
    const existingShares = Number(existing.shares);
    const newShares = existingShares + shares;
    const newCost =
      newShares > 0
        ? (existingShares * Number(existing.cost_per_share) + shares * price) / newShares
        : price;
    const { error: updErr } = await supabase
      .from("investments")
      .update({ shares: newShares, cost_per_share: newCost })
      .eq("id", existing.id);
    if (updErr) return updErr.message;
    investmentId = existing.id;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("investments")
      .insert({ ticker, account, shares, cost_per_share: price })
      .select("id")
      .single();
    if (insErr) return insErr.message;
    investmentId = inserted.id;
  }

  const { error: buyErr } = await supabase.from("investment_purchases").insert({
    investment_id: investmentId,
    shares,
    price_per_share: price,
    amount,
    purchased_at: payload.purchased_at,
    pay_period_id: payload.pay_period_id || null,
    notes: payload.notes?.trim() || null,
  });

  return buyErr?.message ?? null;
}

/** Undo a buy: remove the purchase row and reverse it out of the holding. */
export async function deleteInvestmentPurchase(id: string): Promise<string | null> {
  const { data: purchase, error: findErr } = await supabase
    .from("investment_purchases")
    .select("id, investment_id, shares, price_per_share")
    .eq("id", id)
    .maybeSingle();

  if (findErr) return findErr.message;
  if (!purchase) return "Purchase not found.";

  const { data: holding, error: holdErr } = await supabase
    .from("investments")
    .select("id, shares, cost_per_share")
    .eq("id", purchase.investment_id)
    .maybeSingle();

  if (holdErr) return holdErr.message;

  const { error: delErr } = await supabase.from("investment_purchases").delete().eq("id", id);
  if (delErr) return delErr.message;

  if (!holding) return null;

  const remainingShares = Number(holding.shares) - Number(purchase.shares);
  if (remainingShares <= 1e-8) {
    const { error } = await supabase.from("investments").delete().eq("id", holding.id);
    return error?.message ?? null;
  }

  const remainingCost =
    (Number(holding.shares) * Number(holding.cost_per_share) -
      Number(purchase.shares) * Number(purchase.price_per_share)) /
    remainingShares;

  const { error: updErr } = await supabase
    .from("investments")
    .update({
      shares: remainingShares,
      cost_per_share: Math.max(0, remainingCost),
    })
    .eq("id", holding.id);

  return updErr?.message ?? null;
}

export async function deleteInvestment(id: string): Promise<string | null> {
  // investment_purchases cascade via FK
  const { error } = await supabase.from("investments").delete().eq("id", id);
  return error?.message ?? null;
}
