"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PayPeriod, Category, Expense } from "@/lib/types";
import PeriodFilter from "./PeriodFilter";

interface Props {
  payPeriods: PayPeriod[];
  categories: Category[];
  expenses: Expense[];
}

function fmt(n: number) {
  const rounded = Math.round(n);
  return `$${rounded.toLocaleString()}`;
}

function formatRange(p: PayPeriod) {
  const start = new Date(p.start_date + "T00:00:00");
  const end = new Date(p.end_date + "T00:00:00");
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export default function Overview({ payPeriods, categories, expenses }: Props) {
  const sortedPeriods = useMemo(
    () => [...payPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [payPeriods]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() => sortedPeriods.map((p) => p.id));

  const selectedPeriods = useMemo(
    () => sortedPeriods.filter((p) => selectedIds.includes(p.id)),
    [sortedPeriods, selectedIds]
  );

  const periodStats = useMemo(() => {
    return selectedPeriods.map((p) => {
      const periodExpenses = expenses.filter((e) => e.pay_period_id === p.id);
      const actual = periodExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const income = Number(p.paycheck_amount);
      return { period: p, actual, income, surplus: income - actual };
    });
  }, [selectedPeriods, expenses]);

  const selectedCount = periodStats.length;
  const avgIncome = selectedCount ? periodStats.reduce((sum, p) => sum + p.income, 0) / selectedCount : 0;
  const avgActual = selectedCount ? periodStats.reduce((sum, p) => sum + p.actual, 0) / selectedCount : 0;
  const avgSurplus = selectedCount ? periodStats.reduce((sum, p) => sum + p.surplus, 0) / selectedCount : 0;

  const trendData = periodStats.map((p) => ({
    name: formatRange(p.period),
    income: Math.round(p.income),
    actual: Math.round(p.actual),
  }));

  const overFrequency = useMemo(() => {
    return categories
      .map((category) => {
        const overCount = periodStats.filter((stat) => {
          const categoryActual = expenses
            .filter((e) => e.pay_period_id === stat.period.id && e.category_id === category.id)
            .reduce((sum, e) => sum + Number(e.amount), 0);
          return categoryActual > Number(category.budget_per_period);
        }).length;
        const overPercent = selectedCount ? Math.round((overCount / selectedCount) * 100) : 0;
        return { category, overCount, pct: overPercent };
      })
      .sort((a, b) => b.pct - a.pct || a.category.sort_order - b.category.sort_order);
  }, [categories, periodStats, expenses, selectedCount]);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60 }}>
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(160deg,var(--bg-panel) 0%,var(--bg-page) 100%)",
          borderBottom: "1px solid var(--border)",
          padding: "28px 24px 20px",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 6 }}>
          Overview · Multi-Period Averages
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.5px" }}>Budget</h1>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Averages and trends across the pay periods you select below
        </div>

        <PeriodFilter periods={sortedPeriods} selectedIds={selectedIds} onChange={setSelectedIds} />
      </div>

      <div style={{ padding: "20px 24px 0" }}>
        {sortedPeriods.length === 0 && (
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            No pay periods yet. Run the seed SQL or create one to get started.
          </div>
        )}

        {sortedPeriods.length > 0 && selectedCount === 0 && (
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            Select at least one pay period above.
          </div>
        )}

        {selectedCount > 0 && (
          <>
            {/* SUMMARY CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Periods Selected", val: String(selectedCount), color: "var(--text)", border: "var(--border)" },
                { label: "Avg Paycheck", val: fmt(avgIncome), color: "var(--text)", border: "var(--border)" },
                { label: "Avg Actual Spend", val: fmt(avgActual), color: avgActual > avgIncome ? "var(--danger-text)" : "var(--text)", border: "var(--border)" },
                {
                  label: "Avg Surplus / Buffer",
                  val: `${avgSurplus >= 0 ? "+" : ""}${fmt(avgSurplus)}`,
                  color: avgSurplus >= 0 ? "var(--success-text)" : "var(--danger-text)",
                  border: avgSurplus >= 0 ? "#14532D" : "#7F1D1D",
                },
              ].map((c) => (
                <div key={c.label} style={{ background: "var(--bg-panel)", border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* TREND CHART */}
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 12px 12px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 14, paddingLeft: 6 }}>
                Income vs. Actual Spend — Trend
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top: 0, right: 4, left: -24, bottom: 56 }}>
                  <XAxis dataKey="name" tick={{ fill: "var(--text-faint)", fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "var(--text-faint)", fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }}
                    formatter={(val: number, name: string) => [fmt(val), name === "actual" ? "Actual" : "Income"]}
                  />
                  <Bar dataKey="income" name="income" fill="var(--border)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="actual" radius={[3, 3, 0, 0]}>
                    {trendData.map((entry) => (
                      <Cell key={entry.name} fill={entry.actual > entry.income ? "#EF4444" : "#4ADE80"} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* OVER-BUDGET FREQUENCY */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Over-Budget Frequency
            </div>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "8px 18px" }}>
              {overFrequency.map(({ category, overCount, pct }, i) => (
                <div
                  key={category.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: category.color, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", width: 160, flexShrink: 0 }}>{category.name}</div>
                  <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 2,
                        width: `${pct}%`,
                        background: pct > 0 ? "#EF4444" : "var(--border)",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: pct > 0 ? "var(--danger-text)" : "var(--text-faint)", width: 110, textAlign: "right", flexShrink: 0 }}>
                    {overCount} / {selectedCount} over ({pct}%)
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
