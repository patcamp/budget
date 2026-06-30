"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/lib/supabase";
import { PayPeriod, Category, Expense } from "@/lib/types";
import AddExpenseForm from "./AddExpenseForm";
import CategoryTile from "./CategoryTile";
import PayPeriodPicker from "./PayPeriodPicker";

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
  const [showNewPeriod, setShowNewPeriod] = useState(false);

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
    const newLocked = !isLocked;
    const { error } = await supabase
      .from("pay_periods")
      .update({
        is_locked: newLocked,
        locked_at: newLocked ? new Date().toISOString() : null,
      })
      .eq("id", activePeriod.id);
    setBusy(false);
    if (error) {
      alert(`Failed to update lock state: ${error.message}`);
      return;
    }
    await onRefresh();
  }

  async function createNextPeriod() {
    if (!activePeriod) return;
    setBusy(true);
    // Default: next period starts the day after current period ends,
    // and runs 14 days (biweekly). Adjust dates after creation if needed.
    const nextStart = new Date(activePeriod.end_date);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 13);

    const { data, error } = await supabase
      .from("pay_periods")
      .insert({
        start_date: nextStart.toISOString().slice(0, 10),
        end_date: nextEnd.toISOString().slice(0, 10),
        paycheck_amount: activePeriod.paycheck_amount,
        gross_amount: activePeriod.gross_amount,
        roth_401k: activePeriod.roth_401k,
        brokerage_amount: activePeriod.brokerage_amount,
        savings_amount: activePeriod.savings_amount,
        is_locked: false,
      })
      .select()
      .single();

    setBusy(false);
    if (error) {
      alert(`Failed to create new pay period: ${error.message}`);
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
          onCreateNext={createNextPeriod}
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
