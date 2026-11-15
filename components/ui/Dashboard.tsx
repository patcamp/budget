"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { togglePeriodLock, createPayPeriod, updatePeriodHours } from "@/components/api/dashboard";
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
  selectedPeriodId: string | null;
  onSelectedPeriodIdChange: (id: string | null) => void;
  statementFilter: string;
  onStatementFilterChange: (filter: string) => void;
}

function fmt(n: number) {
  const rounded = Math.round(n);
  return `$${rounded.toLocaleString()}`;
}

function fmtExact(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Dashboard({
  payPeriods,
  categories,
  expenses,
  profile,
  paycheckConfig,
  onRefresh,
  selectedPeriodId,
  onSelectedPeriodIdChange,
  statementFilter,
  onStatementFilterChange,
}: Props) {
  const sortedPeriods = useMemo(
    () => [...payPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [payPeriods]
  );

  const [busy, setBusy] = useState(false);
  const [statementOpen, setStatementOpen] = useState(true);
  const [hoursEditing, setHoursEditing] = useState(false);
  const [hoursDraft, setHoursDraft] = useState({ day: "", night: "" });
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const activePeriod = sortedPeriods.find((p) => p.id === selectedPeriodId) || null;
  const isHourly = paycheckConfig?.pay_type === "hourly";
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
    if (data) onSelectedPeriodIdChange(data.id);
  }

  const barData = categories.map((c) => ({
    name: c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name,
    fullName: c.name,
    budget: Math.round(Number(c.budget_per_period)),
    actual: Math.round(spendByCategory[c.id] || 0),
    color: c.color,
  }));

  const periodLabel = activePeriod
    ? `${new Date(activePeriod.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(activePeriod.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "";

  return (
    <div style={{ minHeight: "100%", paddingBottom: 80 }}>
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(160deg,var(--bg-panel) 0%,var(--bg-page) 100%)",
          borderBottom: "1px solid var(--border)",
          padding: "20px 20px 16px",
        }}
      >
        {profile?.company && (
          <div className="hide-mobile" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 6 }}>
            {profile.company}
          </div>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.5px" }}>
          {profile?.full_name ? `${profile.full_name.split(" ")[0]}'s Budget` : "My Budget"}
        </h1>
        <div className="hide-mobile" style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Live pay-period tracker
        </div>

        <PayPeriodPicker
          periods={sortedPeriods}
          selectedId={selectedPeriodId}
          onSelect={(id) => { onSelectedPeriodIdChange(id); setHoursEditing(false); setHoursError(null); }}
          onCreateNext={handleCreateNextPeriod}
          busy={busy}
        />
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {!activePeriod && (
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            No pay periods yet. Create one to get started.
          </div>
        )}

        {activePeriod && (
          <>
            {/* SURPLUS HERO — primary mobile answer: can I spend? */}
            <div
              style={{
                background: surplus >= 0 ? "var(--success-bg)" : "var(--danger-bg)",
                border: `1px solid ${surplus >= 0 ? "var(--success-border)" : "var(--danger-border)"}`,
                borderRadius: 14,
                padding: "18px 20px",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                    {surplus >= 0 ? "Left to spend" : "Over budget"}
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 800,
                      letterSpacing: "-1px",
                      color: surplus >= 0 ? "var(--success-text)" : "var(--danger-text)",
                      lineHeight: 1.1,
                    }}
                  >
                    {surplus >= 0 ? "" : "−"}
                    {fmt(Math.abs(surplus))}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                    {periodLabel}
                    {" · "}
                    <span style={{ color: isLocked ? "var(--success-text)" : "var(--warning-text)", fontWeight: 600 }}>
                      {isLocked ? "Locked" : "Open"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={toggleLock}
                  disabled={busy}
                  className="tap-target"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid",
                    borderColor: isLocked ? "var(--border-strong)" : "var(--accent)",
                    background: isLocked ? "var(--border)" : "var(--accent-strong)",
                    color: isLocked ? "var(--text-secondary)" : "var(--accent-text)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: busy ? "wait" : "pointer",
                    opacity: busy ? 0.6 : 1,
                    minHeight: 44,
                  }}
                >
                  {isLocked ? "Unlock" : "Lock period"}
                </button>
              </div>
            </div>

            {isLocked && (
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 14, padding: "0 4px" }}>
                This period is locked. Expenses are read-only. Unlock if you need to correct something.
              </div>
            )}

            {/* HOURS (hourly pay only) */}
            {isHourly && paycheckConfig && (
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
                {!hoursEditing ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        Hours This Period
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{dayHours} day</span>
                      <span style={{ fontSize: 13, color: "var(--purple-text)", fontWeight: 600 }}>{nightHours} night</span>
                    </div>
                    {!isLocked && (
                      <button
                        onClick={startEditHours}
                        style={{ padding: "8px 14px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 40 }}
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
                          style={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, padding: "8px 10px", outline: "none", width: 90 }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={saveHours} disabled={busy}
                      style={{ padding: "8px 16px", background: "var(--accent-strong)", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--accent-text)", fontSize: 12, fontWeight: 600, cursor: busy ? "wait" : "pointer", minHeight: 40 }}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => { setHoursEditing(false); setHoursError(null); }}
                      style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 12, cursor: "pointer", minHeight: 40 }}
                    >
                      Cancel
                    </button>
                    {hoursError && <span style={{ fontSize: 12, color: "var(--danger-text)" }}>{hoursError}</span>}
                  </div>
                )}
              </div>
            )}

            {/* SECONDARY SUMMARY CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Paycheck", val: fmt(income), color: "var(--text)" },
                { label: "Budget", val: fmt(totalBudget), color: "var(--purple-text)" },
                {
                  label: "Spent",
                  val: fmt(totalActual),
                  sub: fmtExact(totalActual),
                  color: totalActual > income ? "var(--danger-text)" : "var(--text)",
                },
              ].map((c) => (
                <div key={c.label} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.val}</div>
                  {c.sub && (
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{c.sub}</div>
                  )}
                </div>
              ))}
            </div>

            {/* ADD EXPENSE — desktop inline */}
            {!isLocked && (
              <div className="hide-mobile" style={{ marginBottom: 4 }}>
                <AddExpenseForm
                  payPeriodId={activePeriod.id}
                  categories={categories}
                  onAdded={onRefresh}
                />
              </div>
            )}

            {/* STATEMENT */}
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginTop: 16, marginBottom: 16 }}>
              <div
                onClick={() => setStatementOpen((o) => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-page)",
                  borderBottom: statementOpen ? "1px solid var(--border)" : "none",
                  padding: "12px 16px",
                  cursor: "pointer",
                  gap: 12,
                  minHeight: 48,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Statement
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 500 }}>
                    {periodExpenses.length}
                  </span>
                </div>
                {statementOpen && (
                  <select
                    value={statementFilter}
                    onChange={(e) => onStatementFilterChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      maxWidth: 200,
                      marginLeft: "auto",
                      background: "var(--bg-panel)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-muted)",
                      fontSize: 12,
                      padding: "8px 8px",
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
                  onCategoryFilterChange={onStatementFilterChange}
                />
              )}
            </div>

            {/* BAR CHART — horizontal on mobile via CSS class swap of two charts is heavy;
                use one layout: category on X for desktop, accept horizontal scroll-less by
                using shorter names; on mobile use layout="vertical" via a second chart. */}
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 10px 10px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, paddingLeft: 6 }}>
                Actual vs. Budget
              </div>
              {/* Desktop vertical bars */}
              <div className="hide-mobile">
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
              {/* Mobile horizontal bars */}
              <div className="show-mobile">
                <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 36)}>
                  <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: "var(--text-faint)", fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={88} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(val: number, name: string) => [fmt(val), name === "actual" ? "Actual" : "Budget"]}
                    />
                    <Bar dataKey="budget" name="budget" fill="var(--border)" radius={[0, 3, 3, 0]} barSize={8} />
                    <Bar dataKey="actual" name="actual" radius={[0, 3, 3, 0]} barSize={8}>
                      {barData.map((entry) => (
                        <Cell key={entry.fullName} fill={entry.actual > entry.budget ? "#EF4444" : entry.color} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CATEGORY TILES — progress cards; tap filters statement via onClick optional later */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Categories
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 270px), 1fr))", gap: 10, marginBottom: 24 }}>
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

      {/* Mobile FAB + bottom sheet for add expense */}
      {!isLocked && activePeriod && (
        <>
          <button
            type="button"
            className="show-mobile"
            onClick={() => setAddSheetOpen(true)}
            aria-label="Add expense"
            style={{
              position: "fixed",
              right: 16,
              bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
              zIndex: 45,
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "1px solid var(--accent)",
              background: "var(--accent-strong)",
              color: "var(--accent-text)",
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1,
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
          >
            +
          </button>

          {addSheetOpen && (
            <div
              role="dialog"
              aria-modal="true"
              className="show-mobile-flex"
              onClick={() => setAddSheetOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                zIndex: 60,
                alignItems: "flex-end",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxHeight: "85vh",
                  overflow: "auto",
                  background: "var(--bg-panel)",
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  padding: "18px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>
                  Add expense
                </div>
                <AddExpenseForm
                  payPeriodId={activePeriod.id}
                  categories={categories}
                  onAdded={onRefresh}
                  layout="stacked"
                  autoFocusAmount
                  onClose={() => setAddSheetOpen(false)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
