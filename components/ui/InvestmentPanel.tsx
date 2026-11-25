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

function fmtCompact(n: number) {
  const rounded = Math.round(n);
  return `$${rounded.toLocaleString()}`;
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtShares(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateShort(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function periodLabel(p: PayPeriod) {
  return `${fmtDateShort(p.start_date)} – ${fmtDateShort(p.end_date)}`;
}

function gainColor(n: number) {
  return n >= 0 ? "var(--success-text)" : "var(--danger-text)";
}

/** Stable palette for account allocation chips — semantic distinction, not theme brand. */
const ACCOUNT_COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#A855F7", "#06B6D4", "#F43F5E", "#84CC16", "#EAB308"];

function accountColor(index: number) {
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
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

const inputStyle: React.CSSProperties = {
  background: "var(--bg-page)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 14,
  padding: "10px 12px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginBottom: 6,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  fontWeight: 600,
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={labelStyle}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 0,
        background: "var(--bg-page)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        maxWidth: 260,
      }}
    >
      {([
        ["dollars", "By dollars"],
        ["shares", "By shares"],
      ] as const).map(([value, label]) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            style={{
              padding: "10px 12px",
              background: active ? "var(--accent-strong)" : "transparent",
              border: "none",
              color: active ? "var(--accent-text)" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 40,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function HoldingRow({
  holding,
  purchases,
  periodById,
  expanded,
  onToggle,
  deletingId,
  deletingPurchaseId,
  onDeleteHolding,
  onDeletePurchase,
}: {
  holding: Enriched;
  purchases: InvestmentPurchase[];
  periodById: Map<string, PayPeriod>;
  expanded: boolean;
  onToggle: () => void;
  deletingId: string | null;
  deletingPurchaseId: string | null;
  onDeleteHolding: (id: string) => void;
  onDeletePurchase: (id: string) => void;
}) {
  const buys = purchases.filter((p) => p.investment_id === holding.id);

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="invest-holding-row"
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) repeat(3, minmax(0, 1fr)) 28px",
          gap: 12,
          alignItems: "center",
          padding: "14px 4px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "inherit",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, color: "var(--text)", fontSize: 15 }}>{holding.ticker}</span>
            {holding.hasPrice && (
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                {fmtDollar(holding.price)}{" "}
                <span style={{ color: gainColor(holding.changePercent) }}>{fmtPct(holding.changePercent)}</span>
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-faint)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {holding.quoteName !== holding.ticker ? holding.quoteName : `${fmtShares(Number(holding.shares))} shares`}
            {holding.quoteName !== holding.ticker && (
              <span> · {fmtShares(Number(holding.shares))} sh</span>
            )}
          </div>
        </div>

        <div className="invest-holding-metric">
          <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Value
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
            {holding.hasPrice ? fmtDollar(holding.value) : "—"}
          </div>
        </div>

        <div className="invest-holding-metric">
          <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Gain
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: gainColor(holding.gainLoss), marginTop: 2 }}>
            {holding.hasPrice ? fmtDollar(holding.gainLoss) : "—"}
          </div>
        </div>

        <div className="invest-holding-metric">
          <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Return
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: gainColor(holding.returnPct), marginTop: 2 }}>
            {holding.hasPrice ? fmtPct(holding.returnPct) : "—"}
          </div>
        </div>

        <div
          style={{
            color: "var(--text-faint)",
            fontSize: 18,
            lineHeight: 1,
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 0.15s ease",
            textAlign: "center",
          }}
          aria-hidden
        >
          ›
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 4px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Avg cost {fmtDollar(Number(holding.cost_per_share))} · cost basis {fmtDollar(holding.costBasis)}
            </div>
            <button
              type="button"
              onClick={() => onDeleteHolding(holding.id)}
              disabled={deletingId === holding.id}
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
                opacity: deletingId === holding.id ? 0.4 : 1,
                minHeight: 40,
              }}
            >
              {deletingId === holding.id ? "Removing…" : "Remove holding"}
            </button>
          </div>

          {buys.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "8px 0" }}>No purchase history.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {buys.map((buy) => {
                const period = buy.pay_period_id ? periodById.get(buy.pay_period_id) : null;
                return (
                  <div
                    key={buy.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      background: "var(--bg-page)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                        {fmtDollar(Number(buy.amount))} · {fmtShares(Number(buy.shares))} @ {fmtDollar(Number(buy.price_per_share))}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                        {fmtDate(buy.purchased_at)}
                        {period ? ` · ${periodLabel(period)}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeletePurchase(buy.id)}
                      disabled={deletingPurchaseId === buy.id}
                      className="tap-target"
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "8px 12px",
                        opacity: deletingPurchaseId === buy.id ? 0.4 : 1,
                        minHeight: 40,
                        flexShrink: 0,
                      }}
                    >
                      {deletingPurchaseId === buy.id ? "…" : "Undo"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
  const [logBuyOpen, setLogBuyOpen] = useState(investments.length === 0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const hasPortfolio = investments.length > 0;
  const heroPositive = totalGain >= 0;

  const byAccount = useMemo(() => {
    const map = new Map<string, Enriched[]>();
    for (const inv of enriched) {
      const list = map.get(inv.account) ?? [];
      list.push(inv);
      map.set(inv.account, list);
    }
    return Array.from(map.entries())
      .map(([account, holdings]) => {
        const value = holdings.reduce((s, h) => s + (h.hasPrice ? h.value : h.costBasis), 0);
        const cost = holdings.reduce((s, h) => s + h.costBasis, 0);
        const gain = holdings.reduce((s, h) => s + (h.hasPrice ? h.gainLoss : 0), 0);
        return { account, holdings, value, cost, gain };
      })
      .sort((a, b) => b.value - a.value || a.account.localeCompare(b.account));
  }, [enriched]);

  const allocationTotal = byAccount.reduce((s, a) => s + a.value, 0) || 1;

  const periodContributed = useMemo(() => {
    if (!latestPeriodId) return 0;
    return purchases
      .filter((p) => p.pay_period_id === latestPeriodId)
      .reduce((s, p) => s + Number(p.amount), 0);
  }, [purchases, latestPeriodId]);

  const formQuote = quotes[form.ticker.trim().toUpperCase()];
  const previewShares =
    form.mode === "dollars" && parseFloat(form.dollars) > 0 && parseFloat(form.price_per_share) > 0
      ? parseFloat(form.dollars) / parseFloat(form.price_per_share)
      : null;

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
    setLogBuyOpen(false);
    await onRefresh();
  }

  async function handleDeleteHolding(id: string) {
    if (!confirm("Remove this holding and all its purchase history?")) return;
    setDeletingId(id);
    const err = await deleteInvestment(id);
    setDeletingId(null);
    if (err) { alert(`Failed to delete: ${err}`); return; }
    if (expandedId === id) setExpandedId(null);
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

  return (
    <div style={{ minHeight: "100%", paddingBottom: 80 }}>
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(160deg,var(--bg-panel) 0%,var(--bg-page) 100%)",
          borderBottom: "1px solid var(--border)",
          padding: "20px 16px 16px",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 6 }}>
          Investments · Live quotes
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.5px" }}>
          Portfolio
        </h1>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          Log each buy · holdings roll up by ticker + account
          {loadingQuotes && <span style={{ color: "var(--warning-text)" }}>· refreshing…</span>}
          {quotesError && <span style={{ color: "var(--danger-text)" }}>· {quotesError}</span>}
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* PORTFOLIO HERO */}
        <div
          style={{
            background: hasPortfolio
              ? heroPositive
                ? "var(--success-bg)"
                : "var(--danger-bg)"
              : "var(--bg-panel)",
            border: `1px solid ${
              hasPortfolio
                ? heroPositive
                  ? "var(--success-border)"
                  : "var(--danger-border)"
                : "var(--border)"
            }`,
            borderRadius: 14,
            padding: "18px 18px 16px",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-faint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 6,
                }}
              >
                Market value
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "var(--text)",
                  letterSpacing: "-0.8px",
                  lineHeight: 1.1,
                }}
              >
                {hasPortfolio ? fmtCompact(totalValue || totalCost) : "—"}
              </div>
              {hasPortfolio ? (
                <div style={{ fontSize: 13, marginTop: 8, color: gainColor(totalGain) }}>
                  {fmtDollar(totalGain)} ({fmtPct(totalReturn)})
                  <span style={{ color: "var(--text-faint)" }}> · {fmtDollar(totalCost)} invested</span>
                </div>
              ) : (
                <div style={{ fontSize: 13, marginTop: 8, color: "var(--text-muted)" }}>
                  Log your first buy to start tracking
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLogBuyOpen((o) => !o)}
              style={{
                padding: "10px 14px",
                background: "var(--accent-strong)",
                border: "1px solid var(--accent)",
                borderRadius: 8,
                color: "var(--accent-text)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                minHeight: 44,
                flexShrink: 0,
              }}
            >
              {logBuyOpen ? "Close" : "Log a buy"}
            </button>
          </div>
        </div>

        {/* METRICS */}
        <div className="metric-grid" style={{ marginBottom: 16 }}>
          <div className="metric-card">
            <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              Invested
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              {hasPortfolio ? fmtCompact(totalCost) : "—"}
            </div>
            <div className="metric-card-sub">
              {hasPortfolio ? `${investments.length} holding${investments.length === 1 ? "" : "s"}` : " "}
            </div>
          </div>
          <div className="metric-card">
            <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              This Period
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              {latestPeriodId ? fmtCompact(periodContributed) : "—"}
            </div>
            <div className="metric-card-sub">Buys linked to current period</div>
          </div>
          <div className="metric-card">
            <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              Return
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: hasPortfolio ? gainColor(totalReturn) : "var(--text)" }}>
              {hasPortfolio && priced.length ? fmtPct(totalReturn) : "—"}
            </div>
            <div className="metric-card-sub">
              {hasPortfolio && priced.length ? fmtDollar(totalGain) : " "}
            </div>
          </div>
        </div>

        {/* LOG A BUY */}
        {logBuyOpen && (
          <div
            style={{
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <SectionTitle>Log a buy</SectionTitle>

            <div style={{ marginBottom: 14 }}>
              <ModeToggle mode={form.mode} onChange={(mode) => setForm((f) => ({ ...f, mode }))} />
            </div>

            <div className="invest-form-grid">
              <div>
                <FieldLabel>Ticker</FieldLabel>
                <input
                  style={{ ...inputStyle, textTransform: "uppercase" }}
                  placeholder="VOO"
                  value={form.ticker}
                  autoFocus
                  onChange={(e) => {
                    setPriceTouched(false);
                    setForm((f) => ({ ...f, ticker: e.target.value }));
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogBuy()}
                />
                {formQuote?.ok && formQuote.name && (
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                    {formQuote.name}
                    {formQuote.price > 0 ? ` · ${fmtDollar(formQuote.price)}` : ""}
                  </div>
                )}
              </div>

              <div>
                <FieldLabel>Account</FieldLabel>
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
                  <FieldLabel>Dollars</FieldLabel>
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
                  <FieldLabel>Shares</FieldLabel>
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
                <FieldLabel>Price / share</FieldLabel>
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

              <div>
                <FieldLabel>Date</FieldLabel>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.purchased_at}
                  onChange={(e) => setForm((f) => ({ ...f, purchased_at: e.target.value }))}
                />
              </div>

              <div>
                <FieldLabel>Pay period</FieldLabel>
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
            </div>

            {previewShares != null && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
                ≈ {fmtShares(previewShares)} shares
              </div>
            )}

            {formError && (
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger-text)" }}>{formError}</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button
                type="button"
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
                  minHeight: 44,
                }}
              >
                {adding ? "Logging…" : "Log buy"}
              </button>
              {hasPortfolio && (
                <button
                  type="button"
                  onClick={() => {
                    setLogBuyOpen(false);
                    setFormError(null);
                  }}
                  style={{
                    padding: "10px 18px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: 44,
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 12 }}>
              Same ticker + account merges into one holding (weighted avg cost). Price prefills from Yahoo when available.
            </div>
          </div>
        )}

        {/* ALLOCATION */}
        {byAccount.length > 0 && (
          <div
            style={{
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <SectionTitle>By account</SectionTitle>
            <div
              style={{
                display: "flex",
                height: 10,
                borderRadius: 999,
                overflow: "hidden",
                background: "var(--border-soft)",
                marginBottom: 14,
              }}
            >
              {byAccount.map((acct, i) => (
                <div
                  key={acct.account}
                  title={`${acct.account}: ${fmtDollar(acct.value)}`}
                  style={{
                    width: `${(acct.value / allocationTotal) * 100}%`,
                    background: accountColor(i),
                    minWidth: acct.value > 0 ? 4 : 0,
                  }}
                />
              ))}
            </div>
            <div className="invest-account-grid">
              {byAccount.map((acct, i) => (
                <div
                  key={acct.account}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: accountColor(i),
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {acct.account}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                      {fmtDollar(acct.value)}
                    </div>
                    <div style={{ fontSize: 11, color: gainColor(acct.gain), marginTop: 2 }}>
                      {fmtDollar(acct.gain)}
                      {acct.cost > 0 ? ` (${fmtPct((acct.gain / acct.cost) * 100)})` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HOLDINGS */}
        {hasPortfolio ? (
          byAccount.map((acct) => (
            <div
              key={acct.account}
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "12px 14px 4px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  marginBottom: 4,
                  padding: "4px 4px 8px",
                  borderBottom: "1px solid var(--border-soft)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{acct.account}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {fmtDollar(acct.value)}
                  <span style={{ color: gainColor(acct.gain) }}> · {fmtDollar(acct.gain)}</span>
                </div>
              </div>

              {acct.holdings.map((holding) => (
                <HoldingRow
                  key={holding.id}
                  holding={holding}
                  purchases={purchases}
                  periodById={periodById}
                  expanded={expandedId === holding.id}
                  onToggle={() => setExpandedId((id) => (id === holding.id ? null : holding.id))}
                  deletingId={deletingId}
                  deletingPurchaseId={deletingPurchaseId}
                  onDeleteHolding={handleDeleteHolding}
                  onDeletePurchase={handleDeletePurchase}
                />
              ))}
            </div>
          ))
        ) : (
          !logBuyOpen && (
            <div
              style={{
                background: "var(--bg-panel)",
                border: "1px dashed var(--border-strong)",
                borderRadius: 14,
                padding: 28,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              No holdings yet.{" "}
              <button
                type="button"
                onClick={() => setLogBuyOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-link)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: 0,
                }}
              >
                Log your first buy
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
