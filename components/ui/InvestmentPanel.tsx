"use client";

import { useState, useEffect, useMemo } from "react";
import { logInvestmentBuy, deleteInvestment, deleteInvestmentPurchase } from "@/components/api/investments";
import { fetchQuotes, QuoteResult } from "@/components/api/quotes";
import { toLocalDateString } from "@/lib/dates";
import { Investment, InvestmentPurchase, PayPeriod, PaycheckConfig } from "@/lib/types";

interface Props {
  investments: Investment[];
  purchases: InvestmentPurchase[];
  payPeriods: PayPeriod[];
  paycheckConfig: PaycheckConfig | null;
  onRefresh: () => Promise<void>;
}

function fmtDollar(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function periodLabel(p: PayPeriod) {
  return `${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}`;
}

type EntryMode = "shares" | "dollars";

type FormState = {
  ticker: string;
  account: string;
  mode: EntryMode;
  shares: string;
  dollars: string;
  price_per_share: string;
  purchased_at: string;
  pay_period_id: string;
};

function blankForm(defaultPeriodId: string): FormState {
  return {
    ticker: "",
    account: "",
    mode: "dollars",
    shares: "",
    dollars: "",
    price_per_share: "",
    purchased_at: toLocalDateString(),
    pay_period_id: defaultPeriodId,
  };
}

type Enriched = Investment & {
  price: number;
  hasPrice: boolean;
  quoteName: string;
  changePercent: number;
  costBasis: number;
  value: number;
  gainLoss: number;
  returnPct: number;
};

function gainColor(n: number) {
  return n >= 0 ? "var(--success-text)" : "var(--danger-text)";
}

function HoldingCards({
  holdings,
  deletingId,
  onDelete,
}: {
  holdings: Enriched[];
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {holdings.map((holding) => (
        <div
          key={holding.id}
          style={{
            background: "var(--bg-page)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, color: "var(--text)", fontSize: 16 }}>{holding.ticker}</div>
              {holding.quoteName !== holding.ticker && (
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{holding.quoteName}</div>
              )}
            </div>
            <button
              onClick={() => onDelete(holding.id)}
              disabled={deletingId === holding.id}
              className="tap-target"
              style={{
                background: "transparent",
                border: "1px solid var(--danger-border)",
                borderRadius: 8,
                color: "var(--danger-text)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 12px",
                opacity: deletingId === holding.id ? 0.4 : 1,
                minHeight: 44,
              }}
            >
              Remove
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Value</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                {holding.hasPrice ? fmtDollar(holding.value) : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Gain / Loss</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: gainColor(holding.gainLoss) }}>
                {holding.hasPrice ? fmtDollar(holding.gainLoss) : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Return</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: gainColor(holding.returnPct) }}>
                {holding.hasPrice ? fmtPct(holding.returnPct) : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Price</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                {holding.hasPrice ? (
                  <>
                    {fmtDollar(holding.price)}{" "}
                    <span style={{ color: gainColor(holding.changePercent) }}>{fmtPct(holding.changePercent)}</span>
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 10 }}>
            {Number(holding.shares).toLocaleString("en-US", { maximumFractionDigits: 4 })} shares · avg {fmtDollar(Number(holding.cost_per_share))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InvestmentPanel({
  investments,
  purchases,
  payPeriods,
  paycheckConfig,
  onRefresh,
}: Props) {
  const latestPeriodId = payPeriods.length ? payPeriods[payPeriods.length - 1].id : "";
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm(latestPeriodId));
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [priceTouched, setPriceTouched] = useState(false);

  const tickers = useMemo(
    () => [...new Set(investments.map((i) => i.ticker.toUpperCase()))],
    [investments]
  );
  const tickersKey = tickers.join(",");

  const accountSuggestions = useMemo(() => {
    const names = new Set<string>();
    for (const inv of investments) {
      if (inv.account.trim()) names.add(inv.account.trim());
    }
    for (const acct of paycheckConfig?.accounts ?? []) {
      if (acct.name.trim() && acct.type !== "spending") names.add(acct.name.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [investments, paycheckConfig]);

  const investmentById = useMemo(() => {
    const map = new Map<string, Investment>();
    for (const inv of investments) map.set(inv.id, inv);
    return map;
  }, [investments]);

  const periodById = useMemo(() => {
    const map = new Map<string, PayPeriod>();
    for (const p of payPeriods) map.set(p.id, p);
    return map;
  }, [payPeriods]);

  useEffect(() => {
    if (!tickers.length) {
      setQuotes({});
      setQuotesError(null);
      return;
    }
    let cancelled = false;
    setLoadingQuotes(true);
    setQuotesError(null);
    fetchQuotes(tickers).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setQuotesError(error);
        setLoadingQuotes(false);
        return;
      }
      setQuotes(data);
      setLoadingQuotes(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tickersKey]);

  // Prefill price from live quote when ticker matches and user hasn't edited price.
  useEffect(() => {
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker || priceTouched) return;
    const quote = quotes[ticker];
    if (quote?.ok && quote.price > 0) {
      setForm((f) => ({ ...f, price_per_share: quote.price.toFixed(2) }));
    }
  }, [form.ticker, quotes, priceTouched]);

  // Fetch a quote for a typed ticker that isn't already in holdings.
  useEffect(() => {
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker || ticker.length < 1 || quotes[ticker]) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetchQuotes([ticker]).then(({ data }) => {
        if (cancelled || !data[ticker]) return;
        setQuotes((prev) => ({ ...prev, ...data }));
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [form.ticker, quotes]);

  const enriched: Enriched[] = useMemo(
    () =>
      investments.map((inv) => {
        const quote = quotes[inv.ticker.toUpperCase()];
        const shares = Number(inv.shares);
        const costBasis = shares * Number(inv.cost_per_share);
        const hasPrice = !!quote?.ok && quote.price > 0;
        const price = hasPrice ? quote.price : 0;
        const value = shares * price;
        const gainLoss = value - costBasis;
        const returnPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
        return {
          ...inv,
          price,
          hasPrice,
          quoteName: quote?.name ?? inv.ticker,
          changePercent: quote?.changePercent ?? 0,
          costBasis,
          value,
          gainLoss,
          returnPct,
        };
      }),
    [investments, quotes]
  );

  const priced = enriched.filter((i) => i.hasPrice);
  const totalCost = enriched.reduce((s, i) => s + i.costBasis, 0);
  const totalValue = priced.reduce((s, i) => s + i.value, 0);
  const pricedCost = priced.reduce((s, i) => s + i.costBasis, 0);
  const totalGain = totalValue - pricedCost;
  const totalReturn = pricedCost > 0 ? (totalGain / pricedCost) * 100 : 0;

  const byAccount = useMemo(() => {
    const map = new Map<string, Enriched[]>();
    for (const inv of enriched) {
      const list = map.get(inv.account) ?? [];
      list.push(inv);
      map.set(inv.account, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [enriched]);

  const periodContributed = useMemo(() => {
    if (!latestPeriodId) return 0;
    return purchases
      .filter((p) => p.pay_period_id === latestPeriodId)
      .reduce((s, p) => s + Number(p.amount), 0);
  }, [purchases, latestPeriodId]);

  async function handleLogBuy() {
    const ticker = form.ticker.trim().toUpperCase();
    const account = form.account.trim();
    const price = parseFloat(form.price_per_share);

    if (!ticker) { setFormError("Ticker is required."); return; }
    if (!account) { setFormError("Account is required."); return; }
    if (!price || price < 0) { setFormError("Price per share must be ≥ 0."); return; }

    let shares: number;
    if (form.mode === "dollars") {
      const dollars = parseFloat(form.dollars);
      if (!dollars || dollars <= 0) { setFormError("Amount must be > 0."); return; }
      if (price === 0) { setFormError("Need a price to convert dollars to shares."); return; }
      shares = dollars / price;
    } else {
      shares = parseFloat(form.shares);
      if (!shares || shares <= 0) { setFormError("Shares must be > 0."); return; }
    }

    setAdding(true);
    setFormError(null);

    const err = await logInvestmentBuy({
      ticker,
      account,
      shares,
      price_per_share: price,
      purchased_at: form.purchased_at || toLocalDateString(),
      pay_period_id: form.pay_period_id || null,
    });

    setAdding(false);
    if (err) { setFormError(`Failed to log buy: ${err}`); return; }
    setForm(blankForm(form.pay_period_id || latestPeriodId));
    setPriceTouched(false);
    await onRefresh();
  }

  async function handleDeleteHolding(id: string) {
    if (!confirm("Remove this holding and all its purchase history?")) return;
    setDeletingId(id);
    const err = await deleteInvestment(id);
    setDeletingId(null);
    if (err) { alert(`Failed to delete: ${err}`); return; }
    await onRefresh();
  }

  async function handleDeletePurchase(id: string) {
    if (!confirm("Undo this buy? Shares will be removed from the holding.")) return;
    setDeletingPurchaseId(id);
    const err = await deleteInvestmentPurchase(id);
    setDeletingPurchaseId(null);
    if (err) { alert(`Failed to undo buy: ${err}`); return; }
    await onRefresh();
  }

  const panelStyle: React.CSSProperties = { background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-page)",
    border: "1px solid var(--border)",
    borderRadius: 7,
    color: "var(--text)",
    fontSize: 13,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const modeBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px 12px",
    background: active ? "var(--accent-strong)" : "transparent",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 7,
    color: active ? "var(--accent-text)" : "var(--text-muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 40,
  });

  return (
    <div style={{ padding: "16px 16px", paddingBottom: 80 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Investments</div>
        <div style={{ fontSize: 12, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          Log each buy · holdings roll up automatically · live prices via Yahoo Finance
          {loadingQuotes && <span style={{ color: "var(--warning-text)" }}>· refreshing…</span>}
          {quotesError && <span style={{ color: "var(--danger-text)" }}>· {quotesError}</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total Invested", val: fmtDollar(totalCost), color: "var(--text)" },
          { label: "Market Value", val: fmtDollar(totalValue), color: "var(--text)" },
          { label: "Gain / Loss", val: fmtDollar(totalGain), color: gainColor(totalGain) },
          { label: "Return", val: fmtPct(totalReturn), color: gainColor(totalReturn) },
          ...(latestPeriodId
            ? [{ label: "This Period Buys", val: fmtDollar(periodContributed), color: "var(--text)" }]
            : []),
        ].map((c) => (
          <div key={c.label} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>
              {c.label === "This Period Buys" ? c.val : investments.length ? c.val : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Log a buy — primary action for recurring contributions */}
      <div style={{ ...panelStyle, marginBottom: 16, padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14 }}>
          Log a Buy
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, maxWidth: 280 }}>
          <button type="button" style={modeBtn(form.mode === "dollars")} onClick={() => setForm((f) => ({ ...f, mode: "dollars" }))}>
            By dollars
          </button>
          <button type="button" style={modeBtn(form.mode === "shares")} onClick={() => setForm((f) => ({ ...f, mode: "shares" }))}>
            By shares
          </button>
        </div>

        <div className="invest-add-grid" style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 120px", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.06em" }}>TICKER</div>
            <input
              style={{ ...inputStyle, textTransform: "uppercase" }}
              placeholder="VOO"
              value={form.ticker}
              onChange={(e) => {
                setPriceTouched(false);
                setForm((f) => ({ ...f, ticker: e.target.value }));
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogBuy()}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.06em" }}>ACCOUNT</div>
            <input
              style={inputStyle}
              list="invest-account-suggestions"
              placeholder="Roth 401k"
              value={form.account}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleLogBuy()}
            />
            <datalist id="invest-account-suggestions">
              {accountSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          {form.mode === "dollars" ? (
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.06em" }}>DOLLARS</div>
              <input
                type="number"
                step="0.01"
                min="0"
                style={inputStyle}
                placeholder="500.00"
                value={form.dollars}
                onChange={(e) => setForm((f) => ({ ...f, dollars: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleLogBuy()}
              />
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.06em" }}>SHARES</div>
              <input
                type="number"
                step="0.0001"
                min="0"
                style={inputStyle}
                placeholder="10"
                value={form.shares}
                onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleLogBuy()}
              />
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.06em" }}>PRICE / SHARE</div>
            <input
              type="number"
              step="0.01"
              min="0"
              style={inputStyle}
              placeholder="450.00"
              value={form.price_per_share}
              onChange={(e) => {
                setPriceTouched(true);
                setForm((f) => ({ ...f, price_per_share: e.target.value }));
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogBuy()}
            />
          </div>
        </div>

        <div className="invest-buy-meta" style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 10, alignItems: "end", marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.06em" }}>DATE</div>
            <input
              type="date"
              style={inputStyle}
              value={form.purchased_at}
              onChange={(e) => setForm((f) => ({ ...f, purchased_at: e.target.value }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.06em" }}>PAY PERIOD</div>
            <select
              style={inputStyle}
              value={form.pay_period_id}
              onChange={(e) => setForm((f) => ({ ...f, pay_period_id: e.target.value }))}
            >
              <option value="">None</option>
              {[...payPeriods].reverse().map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                  {p.id === latestPeriodId ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleLogBuy}
            disabled={adding}
            style={{
              padding: "10px 18px",
              background: "var(--accent-strong)",
              border: "1px solid var(--accent)",
              borderRadius: 8,
              color: "var(--accent-text)",
              fontSize: 13,
              fontWeight: 600,
              cursor: adding ? "wait" : "pointer",
              opacity: adding ? 0.6 : 1,
              whiteSpace: "nowrap",
              minHeight: 44,
            }}
          >
            {adding ? "Logging…" : "Log buy"}
          </button>
        </div>

        {form.mode === "dollars" && parseFloat(form.dollars) > 0 && parseFloat(form.price_per_share) > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
            ≈ {(parseFloat(form.dollars) / parseFloat(form.price_per_share)).toLocaleString("en-US", { maximumFractionDigits: 4 })} shares
          </div>
        )}
        {formError && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger-text)" }}>{formError}</div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 10 }}>
          Same ticker + account merges into one holding (weighted avg cost). Price prefills from Yahoo when available.
        </div>
      </div>

      {investments.length > 0 && (
        <>
          {byAccount.length > 1 && (
            <div style={{ ...panelStyle, marginBottom: 16, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12 }}>By Account</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {byAccount.map(([account, holdings]) => {
                  const acctValue = holdings.reduce((s, h) => s + h.value, 0);
                  const acctCost = holdings.reduce((s, h) => s + h.costBasis, 0);
                  const acctGain = acctValue - acctCost;
                  return (
                    <div key={account} style={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{account}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{fmtDollar(acctValue)}</div>
                      <div style={{ fontSize: 11, color: gainColor(acctGain) }}>
                        {fmtDollar(acctGain)} {acctCost > 0 ? `(${fmtPct((acctGain / acctCost) * 100)})` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {byAccount.map(([account, holdings]) => (
            <div key={account} style={{ ...panelStyle, marginBottom: 16, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14 }}>
                {account}
              </div>

              <div className="hide-mobile">
                <div className="scroll-x">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Ticker", "Shares", "Avg Cost", "Price", "Value", "Gain / Loss", "Return", ""].map((h) => (
                          <th key={h} style={{ textAlign: h === "" ? "center" : "right", padding: "0 10px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                            {h === "Ticker" ? <span style={{ textAlign: "left", display: "block" }}>{h}</span> : h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((holding) => (
                        <tr key={holding.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                          <td style={{ padding: "10px 10px" }}>
                            <div style={{ fontWeight: 700, color: "var(--text)" }}>{holding.ticker}</div>
                            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1, whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {holding.quoteName !== holding.ticker ? holding.quoteName : ""}
                            </div>
                          </td>
                          <td style={{ textAlign: "right", padding: "10px 10px", color: "var(--text-muted)" }}>{Number(holding.shares).toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                          <td style={{ textAlign: "right", padding: "10px 10px", color: "var(--text-muted)" }}>{fmtDollar(Number(holding.cost_per_share))}</td>
                          <td style={{ textAlign: "right", padding: "10px 10px", color: "var(--text)", whiteSpace: "nowrap" }}>
                            {holding.hasPrice ? (
                              <>
                                {fmtDollar(holding.price)}
                                <span style={{ display: "block", fontSize: 10, color: gainColor(holding.changePercent) }}>{fmtPct(holding.changePercent)} today</span>
                              </>
                            ) : (
                              <span style={{ color: "var(--text-faint)" }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right", padding: "10px 10px", fontWeight: 600, color: "var(--text)" }}>
                            {holding.hasPrice ? fmtDollar(holding.value) : "—"}
                          </td>
                          <td style={{ textAlign: "right", padding: "10px 10px", color: gainColor(holding.gainLoss), fontWeight: 600 }}>
                            {holding.hasPrice ? fmtDollar(holding.gainLoss) : "—"}
                          </td>
                          <td style={{ textAlign: "right", padding: "10px 10px", color: gainColor(holding.returnPct) }}>
                            {holding.hasPrice ? fmtPct(holding.returnPct) : "—"}
                          </td>
                          <td style={{ textAlign: "center", padding: "10px 6px" }}>
                            <button
                              onClick={() => handleDeleteHolding(holding.id)}
                              disabled={deletingId === holding.id}
                              style={{ background: "transparent", border: "none", color: "#7F1D1D", cursor: "pointer", fontSize: 14, padding: "8px 10px", opacity: deletingId === holding.id ? 0.4 : 1, minWidth: 44, minHeight: 44 }}
                              title="Remove holding"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="show-mobile">
                <HoldingCards holdings={holdings} deletingId={deletingId} onDelete={handleDeleteHolding} />
              </div>
            </div>
          ))}
        </>
      )}

      {investments.length === 0 && (
        <div style={{ ...panelStyle, textAlign: "center", color: "var(--text-faint)", fontSize: 13, marginBottom: 16, padding: 20 }}>
          No holdings yet. Log your first buy above — each paycheck contribution becomes another buy against the same ticker.
        </div>
      )}

      {purchases.length > 0 && (
        <div style={{ ...panelStyle, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14 }}>
            Purchase History
          </div>

          <div className="hide-mobile">
            <div className="scroll-x">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Date", "Ticker", "Account", "Shares", "Price", "Amount", "Period", ""].map((h) => (
                      <th key={h} style={{ textAlign: h === "" ? "center" : h === "Date" || h === "Ticker" || h === "Account" || h === "Period" ? "left" : "right", padding: "0 10px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((buy) => {
                    const holding = investmentById.get(buy.investment_id);
                    const period = buy.pay_period_id ? periodById.get(buy.pay_period_id) : null;
                    return (
                      <tr key={buy.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                        <td style={{ padding: "10px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(buy.purchased_at)}</td>
                        <td style={{ padding: "10px 10px", fontWeight: 700, color: "var(--text)" }}>{holding?.ticker ?? "—"}</td>
                        <td style={{ padding: "10px 10px", color: "var(--text-muted)" }}>{holding?.account ?? "—"}</td>
                        <td style={{ textAlign: "right", padding: "10px 10px", color: "var(--text-muted)" }}>
                          {Number(buy.shares).toLocaleString("en-US", { maximumFractionDigits: 4 })}
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 10px", color: "var(--text-muted)" }}>{fmtDollar(Number(buy.price_per_share))}</td>
                        <td style={{ textAlign: "right", padding: "10px 10px", fontWeight: 600, color: "var(--text)" }}>{fmtDollar(Number(buy.amount))}</td>
                        <td style={{ padding: "10px 10px", color: "var(--text-faint)", fontSize: 12 }}>
                          {period ? periodLabel(period) : "—"}
                        </td>
                        <td style={{ textAlign: "center", padding: "10px 6px" }}>
                          <button
                            onClick={() => handleDeletePurchase(buy.id)}
                            disabled={deletingPurchaseId === buy.id}
                            style={{ background: "transparent", border: "none", color: "#7F1D1D", cursor: "pointer", fontSize: 14, padding: "8px 10px", opacity: deletingPurchaseId === buy.id ? 0.4 : 1, minWidth: 44, minHeight: 44 }}
                            title="Undo buy"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="show-mobile" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {purchases.map((buy) => {
              const holding = investmentById.get(buy.investment_id);
              const period = buy.pay_period_id ? periodById.get(buy.pay_period_id) : null;
              return (
                <div key={buy.id} style={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text)" }}>
                        {holding?.ticker ?? "—"} · {fmtDollar(Number(buy.amount))}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
                        {fmtDate(buy.purchased_at)} · {Number(buy.shares).toLocaleString("en-US", { maximumFractionDigits: 4 })} @ {fmtDollar(Number(buy.price_per_share))}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {holding?.account ?? "—"}
                        {period ? ` · ${periodLabel(period)}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePurchase(buy.id)}
                      disabled={deletingPurchaseId === buy.id}
                      className="tap-target"
                      style={{
                        background: "transparent",
                        border: "1px solid var(--danger-border)",
                        borderRadius: 8,
                        color: "var(--danger-text)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "8px 12px",
                        opacity: deletingPurchaseId === buy.id ? 0.4 : 1,
                        minHeight: 44,
                      }}
                    >
                      Undo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
