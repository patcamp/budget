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

  const n = periodStats.length;
  const avgIncome = n ? periodStats.reduce((s, p) => s + p.income, 0) / n : 0;
  const avgActual = n ? periodStats.reduce((s, p) => s + p.actual, 0) / n : 0;
  const avgSurplus = n ? periodStats.reduce((s, p) => s + p.surplus, 0) / n : 0;

  const trendData = periodStats.map((p) => ({
    name: formatRange(p.period),
    income: Math.round(p.income),
    actual: Math.round(p.actual),
  }));

  const overFrequency = useMemo(() => {
    return categories
      .map((c) => {
        const overCount = periodStats.filter((p) => {
          const catActual = expenses
            .filter((e) => e.pay_period_id === p.period.id && e.category_id === c.id)
            .reduce((s, e) => s + Number(e.amount), 0);
          return catActual > Number(c.budget_per_period);
        }).length;
        const pct = n ? Math.round((overCount / n) * 100) : 0;
        return { category: c, overCount, pct };
      })
      .sort((a, b) => b.pct - a.pct || a.category.sort_order - b.category.sort_order);
  }, [categories, periodStats, expenses, n]);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60 }}>
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(160deg,#0F1825 0%,#080B12 100%)",
          borderBottom: "1px solid #1E293B",
          padding: "28px 24px 20px",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#475569", textTransform: "uppercase", marginBottom: 6 }}>
          Overview · Multi-Period Averages
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-0.5px" }}>Patrick&apos;s Budget</h1>
        <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
          Averages and trends across the pay periods you select below
        </div>

        <PeriodFilter periods={sortedPeriods} selectedIds={selectedIds} onChange={setSelectedIds} />
      </div>

      <div style={{ padding: "20px 24px 0" }}>
        {sortedPeriods.length === 0 && (
          <div style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 12, padding: 24, textAlign: "center", color: "#64748B" }}>
            No pay periods yet. Run the seed SQL or create one to get started.
          </div>
        )}

        {sortedPeriods.length > 0 && n === 0 && (
          <div style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 12, padding: 24, textAlign: "center", color: "#64748B" }}>
            Select at least one pay period above.
          </div>
        )}

        {n > 0 && (
          <>
            {/* SUMMARY CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Periods Selected", val: String(n), color: "#F1F5F9", border: "#1E293B" },
                { label: "Avg Paycheck", val: fmt(avgIncome), color: "#F1F5F9", border: "#1E293B" },
                { label: "Avg Actual Spend", val: fmt(avgActual), color: avgActual > avgIncome ? "#F87171" : "#F1F5F9", border: "#1E293B" },
                {
                  label: "Avg Surplus / Buffer",
                  val: `${avgSurplus >= 0 ? "+" : ""}${fmt(avgSurplus)}`,
                  color: avgSurplus >= 0 ? "#4ADE80" : "#F87171",
                  border: avgSurplus >= 0 ? "#14532D" : "#7F1D1D",
                },
              ].map((c) => (
                <div key={c.label} style={{ background: "#0F1825", border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* TREND CHART */}
            <div style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 14, padding: "20px 12px 12px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 14, paddingLeft: 6 }}>
                Income vs. Actual Spend — Trend
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top: 0, right: 4, left: -24, bottom: 56 }}>
                  <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "#475569", fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ background: "#080B12", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#F1F5F9", fontWeight: 700, marginBottom: 4 }}
                    formatter={(val: number, name: string) => [fmt(val), name === "actual" ? "Actual" : "Income"]}
                  />
                  <Bar dataKey="income" name="income" fill="#1E293B" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="actual" radius={[3, 3, 0, 0]}>
                    {trendData.map((entry) => (
                      <Cell key={entry.name} fill={entry.actual > entry.income ? "#EF4444" : "#4ADE80"} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* OVER-BUDGET FREQUENCY */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Over-Budget Frequency
            </div>
            <div style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 14, padding: "8px 18px" }}>
              {overFrequency.map(({ category, overCount, pct }, i) => (
                <div
                  key={category.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderTop: i === 0 ? "none" : "1px solid #1E293B",
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: category.color, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#CBD5E1", width: 160, flexShrink: 0 }}>{category.name}</div>
                  <div style={{ flex: 1, height: 4, background: "#1E293B", borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 2,
                        width: `${pct}%`,
                        background: pct > 0 ? "#EF4444" : "#1E293B",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: pct > 0 ? "#F87171" : "#475569", width: 110, textAlign: "right", flexShrink: 0 }}>
                    {overCount} / {n} over ({pct}%)
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
