"use client";

import { useState, useEffect, useMemo } from "react";
import { addInvestment, deleteInvestment } from "@/components/api/investments";
import { Investment } from "@/lib/types";
import type { QuoteResult } from "@/app/api/quotes/route";

interface Props {
  investments: Investment[];
  onRefresh: () => Promise<void>;
}

function fmtDollar(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

const BLANK_FORM = { ticker: "", account: "", shares: "", cost_per_share: "" };

export default function InvestmentPanel({ investments, onRefresh }: Props) {
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const tickers = useMemo(
    () => [...new Set(investments.map((i) => i.ticker.toUpperCase()))],
    [investments]
  );

  useEffect(() => {
    if (!tickers.length) { setQuotes({}); return; }
    setLoadingQuotes(true);
    fetch(`/api/quotes?symbols=${tickers.join(",")}`)
      .then((r) => r.json())
      .then((data) => { setQuotes(data); setLoadingQuotes(false); })
      .catch(() => setLoadingQuotes(false));
  // tickers.join(",") as the dep — the array reference changes every render, which would
  // cause an infinite fetch loop if used directly.
  }, [tickers.join(",")]);

  const enriched = useMemo(() =>
    investments.map((inv) => {
      const quote = quotes[inv.ticker.toUpperCase()];
      const shares = Number(inv.shares);
      const costBasis = shares * Number(inv.cost_per_share);
      const price = quote?.price ?? 0;
      const value = shares * price;
      const gainLoss = value - costBasis;
      const returnPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
      return { ...inv, price, quoteName: quote?.name ?? inv.ticker, changePercent: quote?.changePercent ?? 0, costBasis, value, gainLoss, returnPct };
    }),
    [investments, quotes]
  );

  const totalCost = enriched.reduce((s, i) => s + i.costBasis, 0);
  const totalValue = enriched.reduce((s, i) => s + i.value, 0);
  const totalGain = totalValue - totalCost;
  const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const byAccount = useMemo(() => {
    const map = new Map<string, typeof enriched>();
    for (const inv of enriched) {
      const list = map.get(inv.account) ?? [];
      list.push(inv);
      map.set(inv.account, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [enriched]);

  async function handleAddHolding() {
    const ticker = form.ticker.trim().toUpperCase();
    const account = form.account.trim();
    const shares = parseFloat(form.shares);
    const cost = parseFloat(form.cost_per_share);

    if (!ticker) { setFormError("Ticker is required."); return; }
    if (!account) { setFormError("Account is required."); return; }
    if (!shares || shares <= 0) { setFormError("Shares must be > 0."); return; }
    if (!cost || cost < 0) { setFormError("Cost per share must be ≥ 0."); return; }

    setAdding(true);
    setFormError(null);
    const err = await addInvestment({ ticker, account, shares, cost_per_share: cost });
    setAdding(false);
    if (err) { setFormError(`Failed to add: ${err}`); return; }
    setForm(BLANK_FORM);
    await onRefresh();
  }

  async function handleDeleteHolding(id: string) {
    setDeletingId(id);
    const err = await deleteInvestment(id);
    setDeletingId(null);
    if (err) { alert(`Failed to delete: ${err}`); return; }
    await onRefresh();
  }

  const panelStyle: React.CSSProperties = { background: "#0F1825", border: "1px solid #1E293B", borderRadius: 12, padding: 20 };
  const gainColor = (n: number) => n >= 0 ? "#4ADE80" : "#F87171";

  const inputStyle: React.CSSProperties = {
    background: "#080B12",
    border: "1px solid #1E293B",
    borderRadius: 7,
    color: "#F1F5F9",
    fontSize: 13,
    padding: "8px 10px",
    outline: "none",
  };

  return (
    <div style={{ padding: "20px 24px", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>Investments</div>
        <div style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
          Live prices via Yahoo Finance
          {loadingQuotes && <span style={{ color: "#FBBF24" }}>· refreshing…</span>}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Invested", val: fmtDollar(totalCost), color: "#F1F5F9" },
          { label: "Market Value", val: fmtDollar(totalValue), color: "#F1F5F9" },
          { label: "Total Gain / Loss", val: fmtDollar(totalGain), color: gainColor(totalGain) },
          { label: "Total Return", val: fmtPct(totalReturn), color: gainColor(totalReturn) },
        ].map((c) => (
          <div key={c.label} style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{investments.length ? c.val : "—"}</div>
          </div>
        ))}
      </div>

      {investments.length > 0 && (
        <>
          {/* By-account rollup */}
          {byAccount.length > 1 && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14 }}>By Account</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {byAccount.map(([account, holdings]) => {
                  const acctValue = holdings.reduce((s, h) => s + h.value, 0);
                  const acctCost = holdings.reduce((s, h) => s + h.costBasis, 0);
                  const acctGain = acctValue - acctCost;
                  return (
                    <div key={account} style={{ background: "#080B12", border: "1px solid #1E293B", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>{account}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#F1F5F9", marginBottom: 2 }}>{fmtDollar(acctValue)}</div>
                      <div style={{ fontSize: 11, color: gainColor(acctGain) }}>
                        {fmtDollar(acctGain)} {acctCost > 0 ? `(${fmtPct((acctGain / acctCost) * 100)})` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Holdings table per account */}
          {byAccount.map(([account, holdings]) => (
            <div key={account} style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14 }}>
                {account}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1E293B" }}>
                      {["Ticker", "Shares", "Avg Cost", "Price", "Value", "Gain / Loss", "Return", ""].map((h) => (
                        <th key={h} style={{ textAlign: h === "" ? "center" : "right", padding: "0 10px 10px", fontSize: 10, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                          {h === "Ticker" ? <span style={{ textAlign: "left", display: "block" }}>{h}</span> : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding) => (
                      <tr key={holding.id} style={{ borderBottom: "1px solid #131D2E" }}>
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ fontWeight: 700, color: "#F1F5F9" }}>{holding.ticker}</div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 1, whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{holding.quoteName !== holding.ticker ? holding.quoteName : ""}</div>
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 10px", color: "#94A3B8" }}>{Number(holding.shares).toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                        <td style={{ textAlign: "right", padding: "10px 10px", color: "#64748B" }}>{fmtDollar(Number(holding.cost_per_share))}</td>
                        <td style={{ textAlign: "right", padding: "10px 10px", color: "#F1F5F9", whiteSpace: "nowrap" }}>
                          {holding.price > 0 ? (
                            <>
                              {fmtDollar(holding.price)}
                              <span style={{ display: "block", fontSize: 10, color: gainColor(holding.changePercent) }}>{fmtPct(holding.changePercent)} today</span>
                            </>
                          ) : (
                            <span style={{ color: "#374151" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 10px", fontWeight: 600, color: "#F1F5F9" }}>
                          {holding.price > 0 ? fmtDollar(holding.value) : "—"}
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 10px", color: gainColor(holding.gainLoss), fontWeight: 600 }}>
                          {holding.price > 0 ? fmtDollar(holding.gainLoss) : "—"}
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 10px", color: gainColor(holding.returnPct) }}>
                          {holding.price > 0 ? fmtPct(holding.returnPct) : "—"}
                        </td>
                        <td style={{ textAlign: "center", padding: "10px 6px" }}>
                          <button
                            onClick={() => handleDeleteHolding(holding.id)}
                            disabled={deletingId === holding.id}
                            style={{ background: "transparent", border: "none", color: "#7F1D1D", cursor: "pointer", fontSize: 14, padding: "2px 6px", opacity: deletingId === holding.id ? 0.4 : 1 }}
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
          ))}
        </>
      )}

      {investments.length === 0 && (
        <div style={{ ...panelStyle, textAlign: "center", color: "#475569", fontSize: 13, marginBottom: 20 }}>
          No holdings yet. Add one below.
        </div>
      )}

      {/* Add holding form */}
      <div style={{ ...panelStyle, overflowX: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14 }}>Add Holding</div>
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 140px auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4, letterSpacing: "0.06em" }}>TICKER</div>
            <input
              style={{ ...inputStyle, width: "100%", textTransform: "uppercase", boxSizing: "border-box" }}
              placeholder="VOO"
              value={form.ticker}
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleAddHolding()}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4, letterSpacing: "0.06em" }}>ACCOUNT</div>
            <input
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              placeholder="Roth 401k"
              value={form.account}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleAddHolding()}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4, letterSpacing: "0.06em" }}>SHARES</div>
            <input
              type="number"
              step="0.0001"
              min="0"
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              placeholder="10"
              value={form.shares}
              onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleAddHolding()}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4, letterSpacing: "0.06em" }}>AVG COST / SHARE</div>
            <input
              type="number"
              step="0.01"
              min="0"
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              placeholder="450.00"
              value={form.cost_per_share}
              onChange={(e) => setForm((f) => ({ ...f, cost_per_share: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleAddHolding()}
            />
          </div>
          <button
            onClick={handleAddHolding}
            disabled={adding}
            style={{
              padding: "8px 18px",
              background: "#1D4ED8",
              border: "1px solid #3B82F6",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: adding ? "wait" : "pointer",
              opacity: adding ? 0.6 : 1,
              whiteSpace: "nowrap",
              height: 36,
            }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {formError && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#F87171" }}>{formError}</div>
        )}
        <div style={{ fontSize: 11, color: "#374151", marginTop: 10 }}>
          Prices are fetched from Yahoo Finance. Use standard ticker symbols (VOO, VTI, VTSAX, AAPL, BTC-USD, etc.).
        </div>
      </div>
    </div>
  );
}
