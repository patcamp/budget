"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { togglePeriodLock, createPayPeriod, updatePeriodHours } from "@/components/api/dashboard";
import { nightRate } from "@/lib/paycheck";
import { PayPeriod, Category, Expense, Profile, PaycheckConfig } from "@/lib/types";
import AddExpenseForm from "./AddExpenseForm";
import CategoryTile from "./CategoryTile";
import PayPeriodPicker from "./PayPeriodPicker";
import Statement from "./Statement";

interface Props {
  payPeriods: PayPeriod[];
  categories: Category[];
  expenses: Expense[];
  profile: Profile | null;
  paycheckConfig: PaycheckConfig | null;
  onRefresh: () => Promise<void>;
}

function fmt(n: number) {
  const rounded = Math.round(n);
  return `$${rounded.toLocaleString()}`;
}

function fmtExact(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Dashboard({ payPeriods, categories, expenses, profile, paycheckConfig, onRefresh }: Props) {
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
  const [hoursEditing, setHoursEditing] = useState(false);
  const [hoursDraft, setHoursDraft] = useState({ day: "", night: "" });
  const [hoursError, setHoursError] = useState<string | null>(null);

  const activePeriod = sortedPeriods.find((p) => p.id === selectedPeriodId) || null;
  const isHourly = paycheckConfig?.pay_type === "hourly";
  // Periods created before the hourly migration have null hours — fall back
  // to the config's default schedule for display.
  const dayHours = activePeriod?.day_hours ?? Number(paycheckConfig?.default_day_hours ?? 0);
  const nightHours = activePeriod?.night_hours ?? Number(paycheckConfig?.default_night_hours ?? 0);

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

  function startEditHours() {
    setHoursDraft({ day: String(dayHours), night: String(nightHours) });
    setHoursError(null);
    setHoursEditing(true);
  }

  async function saveHours() {
    if (!activePeriod || !paycheckConfig) return;
    const day = parseFloat(hoursDraft.day);
    const night = parseFloat(hoursDraft.night);
    if (isNaN(day) || day < 0 || isNaN(night) || night < 0) {
      setHoursError("Hours must be valid non-negative numbers.");
      return;
    }
    setBusy(true);
    const err = await updatePeriodHours(activePeriod.id, paycheckConfig, day, night);
    setBusy(false);
    if (err) { setHoursError(err); return; }
    setHoursEditing(false);
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
          background: "linear-gradient(160deg,var(--bg-panel) 0%,var(--bg-page) 100%)",
          borderBottom: "1px solid var(--border)",
          padding: "28px 24px 20px",
        }}
      >
        {profile?.company && (
          <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 6 }}>
            {profile.company}
          </div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.5px" }}>
          {profile?.full_name ? `${profile.full_name.split(" ")[0]}'s Budget` : "My Budget"}
        </h1>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Live pay-period tracker
        </div>

        <PayPeriodPicker
          periods={sortedPeriods}
          selectedId={selectedPeriodId}
          onSelect={(id) => { setSelectedPeriodId(id); setHoursEditing(false); setHoursError(null); }}
          onCreateNext={handleCreateNextPeriod}
          busy={busy}
        />
      </div>

      <div style={{ padding: "20px 24px 0" }}>
        {!activePeriod && (
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
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
                background: isLocked ? "var(--success-bg)" : "var(--bg-panel)",
                border: `1px solid ${isLocked ? "var(--success-border)" : "var(--border)"}`,
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
                    background: isLocked ? "var(--success-text)" : "var(--warning-text)",
                  }}
                />
                <div style={{ fontSize: 13, fontWeight: 600, color: isLocked ? "var(--success-text)" : "var(--warning-text)" }}>
                  {isLocked ? "Locked — Final" : "Open — Tracking in progress"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
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
                  borderColor: isLocked ? "var(--border-strong)" : "var(--accent)",
                  background: isLocked ? "var(--border)" : "var(--accent-strong)",
                  color: isLocked ? "var(--text-secondary)" : "var(--accent-text)",
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
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 16, padding: "0 4px" }}>
                This period is locked. Expenses are read-only. Unlock if you need to correct something.
              </div>
            )}

            {/* HOURS (hourly pay only) */}
            {isHourly && paycheckConfig && (
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 18px", marginBottom: 18 }}>
                {!hoursEditing ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        Hours This Period
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                        {dayHours} day
                      </span>
                      <span style={{ fontSize: 13, color: "var(--purple-text)", fontWeight: 600 }}>
                        {nightHours} night
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                        night rate ${nightRate(Number(paycheckConfig.hourly_rate), paycheckConfig.night_diff_type, Number(paycheckConfig.night_diff_value)).toFixed(2)}/hr
                      </span>
                    </div>
                    {!isLocked && (
                      <button
                        onClick={startEditHours}
                        style={{ padding: "5px 14px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                      >
                        Edit Hours
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                    {(["day", "night"] as const).map((kind) => (
                      <div key={kind}>
                        <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                          {kind} hours
                        </label>
                        <input
                          type="number" step="0.25" min="0" value={hoursDraft[kind]}
                          onChange={(e) => setHoursDraft((d) => ({ ...d, [kind]: e.target.value }))}
                          style={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, padding: "6px 10px", outline: "none", width: 90 }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={saveHours} disabled={busy}
                      style={{ padding: "7px 16px", background: "var(--accent-strong)", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--accent-text)", fontSize: 12, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => { setHoursEditing(false); setHoursError(null); }}
                      style={{ padding: "7px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    {hoursError && <span style={{ fontSize: 12, color: "var(--danger-text)" }}>{hoursError}</span>}
                  </div>
                )}
              </div>
            )}

            {/* SUMMARY CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Paycheck", val: fmt(income), color: "var(--text)", border: "var(--border)" },
                { label: "Budget Total", val: fmt(totalBudget), color: "var(--purple-text)", border: "var(--border)" },
                {
                  label: "Actual Spend",
                  val: fmt(totalActual),
                  sub: fmtExact(totalActual),
                  color: totalActual > income ? "var(--danger-text)" : "var(--text)",
                  border: "var(--border)",
                },
                {
                  label: "Surplus / Buffer",
                  val: `${surplus >= 0 ? "+" : ""}${fmt(surplus)}`,
                  color: surplus >= 0 ? "var(--success-text)" : "var(--danger-text)",
                  border: surplus >= 0 ? "#14532D" : "#7F1D1D",
                },
              ].map((c) => (
                <div key={c.label} style={{ background: "var(--bg-panel)", border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.val}</div>
                  {c.sub && (
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{c.sub}</div>
                  )}
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
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginTop: 20, marginBottom: 20 }}>
              <div
                onClick={() => setStatementOpen((o) => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-page)",
                  borderBottom: statementOpen ? "1px solid var(--border)" : "none",
                  padding: "12px 18px",
                  cursor: "pointer",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Statement
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 500 }}>
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
                      background: "var(--bg-panel)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-muted)",
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
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, flexShrink: 0 }}>
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
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 12px 12px", marginBottom: 20, marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 14, paddingLeft: 6 }}>
                Actual vs. Budget — This Period
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 0, right: 4, left: -24, bottom: 56 }}>
                  <XAxis dataKey="name" tick={{ fill: "var(--text-faint)", fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "var(--text-faint)", fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }}
                    formatter={(val: number, name: string) => [fmt(val), name === "actual" ? "Actual" : "Budget"]}
                  />
                  <Bar dataKey="budget" name="budget" fill="var(--border)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="actual" radius={[3, 3, 0, 0]}>
                    {barData.map((entry) => (
                      <Cell key={entry.fullName} fill={entry.actual > entry.budget ? "#EF4444" : entry.color} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* CATEGORY TILES */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
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
