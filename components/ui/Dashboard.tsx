"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { togglePeriodLock, createPayPeriod } from "@/components/api/dashboard";
import { PayPeriod, Category, Expense } from "@/lib/types";
import AddExpenseForm from "./AddExpenseForm";
import CategoryTile from "./CategoryTile";
import PayPeriodPicker from "./PayPeriodPicker";
import Statement from "./Statement";

interface Props {
  payPeriods: PayPeriod[];
  categories: Category[];
  expenses: Expense[];
  onRefresh: () => Promise<void>;
}

function fmt(n: number) {
  const rounded = Math.round(n);
  return `$${rounded.toLocaleString()}`;
}

export default function Dashboard({ payPeriods, categories, expenses, onRefresh }: Props) {
  const sortedPeriods = useMemo(
    () => [...payPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [payPeriods]
  );

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(
    sortedPeriods.length ? sortedPeriods[sortedPeriods.length - 1].id : null
  );
  const [busy, setBusy] = useState(false);
  const [statementOpen, setStatementOpen] = useState(true);
  const [statementFilter, setStatementFilter] = useState("all");

  const activePeriod = sortedPeriods.find((p) => p.id === selectedPeriodId) || null;

  const periodExpenses = useMemo(
    () => expenses.filter((e) => e.pay_period_id === activePeriod?.id),
    [expenses, activePeriod]
  );

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of periodExpenses) {
      map[e.category_id] = (map[e.category_id] || 0) + Number(e.amount);
    }
    return map;
  }, [periodExpenses]);

  const totalBudget = categories.reduce((s, c) => s + Number(c.budget_per_period), 0);
  const totalActual = Object.values(spendByCategory).reduce((s, v) => s + v, 0);
  const income = activePeriod ? Number(activePeriod.paycheck_amount) : 0;
  const surplus = income - totalActual;

  const isLocked = activePeriod?.is_locked ?? false;

  async function toggleLock() {
    if (!activePeriod) return;
    setBusy(true);
    const err = await togglePeriodLock(activePeriod.id, !isLocked);
    setBusy(false);
    if (err) {
      alert(`Failed to update lock state: ${err}`);
      return;
    }
    await onRefresh();
  }

  async function handleCreateNextPeriod() {
    if (!activePeriod) return;
    setBusy(true);
    const { data, error } = await createPayPeriod(activePeriod);
    setBusy(false);
    if (error) {
      alert(`Failed to create new pay period: ${error}`);
      return;
    }
    await onRefresh();
    if (data) setSelectedPeriodId(data.id);
  }

  const barData = categories.map((c) => ({
    name: c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name,
    fullName: c.name,
    budget: Math.round(Number(c.budget_per_period)),
    actual: Math.round(spendByCategory[c.id] || 0),
    color: c.color,
  }));

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
          Booz Allen Hamilton · Semi-Monthly
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-0.5px" }}>Patrick&apos;s Budget</h1>
        <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
          Live pay-period tracker · Supabase-backed
        </div>

        <PayPeriodPicker
          periods={sortedPeriods}
          selectedId={selectedPeriodId}
          onSelect={setSelectedPeriodId}
          onCreateNext={handleCreateNextPeriod}
          busy={busy}
        />
      </div>

      <div style={{ padding: "20px 24px 0" }}>
        {!activePeriod && (
          <div style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 12, padding: 24, textAlign: "center", color: "#64748B" }}>
            No pay periods yet. Run the seed SQL or create one to get started.
          </div>
        )}

        {activePeriod && (
          <>
            {/* LOCK STATUS BAR */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: isLocked ? "#0D1F14" : "#0F1825",
                border: `1px solid ${isLocked ? "#166534" : "#1E293B"}`,
                borderRadius: 10,
                padding: "12px 18px",
                marginBottom: 18,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isLocked ? "#4ADE80" : "#FBBF24",
                  }}
                />
                <div style={{ fontSize: 13, fontWeight: 600, color: isLocked ? "#4ADE80" : "#FBBF24" }}>
                  {isLocked ? "Locked — Final" : "Open — Tracking in progress"}
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  {new Date(activePeriod.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" – "}
                  {new Date(activePeriod.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <button
                onClick={toggleLock}
                disabled={busy}
                style={{
                  padding: "7px 16px",
                  borderRadius: 7,
                  border: "1px solid",
                  borderColor: isLocked ? "#334155" : "#166534",
                  background: isLocked ? "#1E293B" : "#15803D",
                  color: isLocked ? "#CBD5E1" : "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {isLocked ? "Unlock to Edit" : "Lock This Period"}
              </button>
            </div>

            {isLocked && (
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 16, padding: "0 4px" }}>
                This period is locked. Expenses are read-only. Unlock if you need to correct something.
              </div>
            )}

            {/* SUMMARY CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Paycheck", val: fmt(income), color: "#F1F5F9", border: "#1E293B" },
                { label: "Budget Total", val: fmt(totalBudget), color: "#A78BFA", border: "#2D1B69" },
                {
                  label: "Actual Spend",
                  val: fmt(totalActual),
                  color: totalActual > income ? "#F87171" : "#F1F5F9",
                  border: "#1E293B",
                },
                {
                  label: "Surplus / Buffer",
                  val: `${surplus >= 0 ? "+" : ""}${fmt(surplus)}`,
                  color: surplus >= 0 ? "#4ADE80" : "#F87171",
                  border: surplus >= 0 ? "#14532D" : "#7F1D1D",
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

            {/* ADD EXPENSE FORM */}
            {!isLocked && (
              <AddExpenseForm
                payPeriodId={activePeriod.id}
                categories={categories}
                onAdded={onRefresh}
              />
            )}

            {/* STATEMENT */}
            <div style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 12, overflow: "hidden", marginTop: 20, marginBottom: 20 }}>
              <div
                onClick={() => setStatementOpen((o) => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#080B12",
                  borderBottom: statementOpen ? "1px solid #1E293B" : "none",
                  padding: "12px 18px",
                  cursor: "pointer",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Statement
                  </span>
                  <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>
                    {periodExpenses.length} transaction{periodExpenses.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {statementOpen && (
                  <select
                    value={statementFilter}
                    onChange={(e) => setStatementFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()} // prevent click bubbling to the collapse toggle
                    style={{
                      flex: 1,
                      maxWidth: 200,
                      marginLeft: "auto",
                      background: "#0F1825",
                      border: "1px solid #1E293B",
                      borderRadius: 6,
                      color: "#94A3B8",
                      fontSize: 12,
                      padding: "5px 8px",
                      outline: "none",
                      cursor: "default",
                    }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, flexShrink: 0 }}>
                  {statementOpen ? "▲" : "▼"}
                </span>
              </div>
              {statementOpen && (
                <Statement
                  expenses={periodExpenses}
                  categories={categories}
                  locked={isLocked}
                  onChanged={onRefresh}
                  noCard
                  categoryFilter={statementFilter}
                  onCategoryFilterChange={setStatementFilter}
                />
              )}
            </div>

            {/* BAR CHART */}
            <div style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 14, padding: "20px 12px 12px", marginBottom: 20, marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 14, paddingLeft: 6 }}>
                Actual vs. Budget — This Period
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 0, right: 4, left: -24, bottom: 56 }}>
                  <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "#475569", fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ background: "#080B12", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#F1F5F9", fontWeight: 700, marginBottom: 4 }}
                    formatter={(val: number, name: string) => [fmt(val), name === "actual" ? "Actual" : "Budget"]}
                  />
                  <Bar dataKey="budget" name="budget" fill="#1E293B" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="actual" radius={[3, 3, 0, 0]}>
                    {barData.map((entry) => (
                      <Cell key={entry.fullName} fill={entry.actual > entry.budget ? "#EF4444" : entry.color} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* CATEGORY TILES */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Categories
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 10 }}>
              {categories.map((c) => (
                <CategoryTile
                  key={c.id}
                  category={c}
                  categories={categories}
                  actual={spendByCategory[c.id] || 0}
                  expenses={periodExpenses.filter((e) => e.category_id === c.id)}
                  locked={isLocked}
                  onChanged={onRefresh}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
