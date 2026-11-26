"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { togglePeriodLock, createPayPeriod, createFirstPayPeriod, updatePeriodHours } from "@/components/api/dashboard";
import { PayPeriod, Category, Expense, Profile, PaycheckConfig, RecurringExpense } from "@/lib/types";
import { computePeriodPace } from "@/lib/pace";
import { clampDateLocal, toLocalDateString } from "@/lib/dates";
import AddExpenseForm, { useExpenseDraft } from "./AddExpenseForm";
import CategoryTile from "./CategoryTile";
import CsvImportModal from "./CsvImportModal";
import PayPeriodPicker from "./PayPeriodPicker";
import Statement from "./Statement";
import { useToast } from "./Toast";

interface Props {
  payPeriods: PayPeriod[];
  categories: Category[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
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

function fmtDaily(n: number) {
  if (n > 0 && n < 10) return fmtExact(n);
  return fmt(n);
}

export default function Dashboard({
  payPeriods,
  categories,
  expenses,
  recurringExpenses,
  profile,
  paycheckConfig,
  onRefresh,
  selectedPeriodId,
  onSelectedPeriodIdChange,
  statementFilter,
  onStatementFilterChange,
}: Props) {
  const toast = useToast();
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
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const activePeriod = sortedPeriods.find((p) => p.id === selectedPeriodId) || null;
  // Owned here (not inside each AddExpenseForm) so the desktop inline form and
  // the mobile sheet share one draft — and sessionStorage can restore it after
  // a remount when switching apps / tabs.
  const expenseDraft = useExpenseDraft(activePeriod?.id ?? "", categories);
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

  const pace = useMemo(() => {
    if (!activePeriod) return null;
    return computePeriodPace({
      startDate: activePeriod.start_date,
      endDate: activePeriod.end_date,
      surplus,
      totalSpent: totalActual,
    });
  }, [activePeriod, surplus, totalActual]);

  const isLocked = activePeriod?.is_locked ?? false;
  const validCategoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);

  async function toggleLock() {
    if (!activePeriod) return;
    setBusy(true);
    const nextLocked = !isLocked;
    const err = await togglePeriodLock(activePeriod.id, nextLocked);
    setBusy(false);
    if (err) {
      toast.error(`Failed to update lock state: ${err}`);
      return;
    }
    toast.success(nextLocked ? "Pay period locked." : "Pay period unlocked.");
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
    if (err) {
      setHoursError(err);
      toast.error(`Failed to save hours: ${err}`);
      return;
    }
    setHoursEditing(false);
    toast.success("Hours updated.");
    await onRefresh();
  }

  async function handleCreateNextPeriod() {
    if (!activePeriod) return;
    setBusy(true);
    const { data, insertedRecurringCount, error, recurringError } = await createPayPeriod(
      activePeriod,
      recurringExpenses,
      validCategoryIds
    );
    setBusy(false);
    if (error) {
      toast.error(`Failed to create new pay period: ${error}`);
      return;
    }
    if (recurringError) {
      toast.error(`Period created, but recurring items failed: ${recurringError}`);
    } else if (insertedRecurringCount > 0) {
      toast.success(
        `New pay period created with ${insertedRecurringCount} recurring expense${insertedRecurringCount === 1 ? "" : "s"}.`
      );
    } else {
      toast.success("New pay period created.");
    }
    await onRefresh();
    if (data) onSelectedPeriodIdChange(data.id);
  }

  async function handleCreateFirstPeriod() {
    setBusy(true);
    const { data, insertedRecurringCount, error, recurringError } = await createFirstPayPeriod(
      paycheckConfig,
      recurringExpenses,
      validCategoryIds
    );
    setBusy(false);
    if (error) {
      toast.error(`Failed to create pay period: ${error}`);
      return;
    }
    if (recurringError) {
      toast.error(`Period created, but recurring items failed: ${recurringError}`);
    } else if (insertedRecurringCount > 0) {
      toast.success(
        `Pay period created with ${insertedRecurringCount} recurring expense${insertedRecurringCount === 1 ? "" : "s"}.`
      );
    } else {
      toast.success("First pay period created.");
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
          <div style={{ background: "var(--bg-panel)", border: "1px dashed var(--border-strong)", borderRadius: 14, padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              No pay periods yet
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 380, margin: "0 auto 16px", lineHeight: 1.5 }}>
              Start your first 14-day pay period to track spending, daily pace, and category budgets.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleCreateFirstPeriod}
                disabled={busy}
                className="tap-target"
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "1px solid var(--accent)",
                  background: "var(--accent-strong)",
                  color: "var(--accent-text)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                {busy ? "Creating…" : "+ Create First Pay Period"}
              </button>
              <Link
                href="/admin"
                className="tap-target"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  minHeight: 44,
                }}
              >
                Configure Paycheck
              </Link>
            </div>
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
                padding: "16px 16px 16px 18px",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
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
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {surplus >= 0 ? "" : "−"}
                    {fmt(Math.abs(surplus))}
                  </div>

                  {/* SECONDARY HERO — Daily safe-to-spend / remaining pace */}
                  {pace && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: `1px solid ${surplus >= 0 ? "var(--success-border)" : "var(--danger-border)"}`,
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          letterSpacing: "-0.4px",
                          color:
                            pace.status === "ended"
                              ? "var(--text)"
                              : surplus >= 0
                                ? "var(--text)"
                                : "var(--danger-text)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {pace.status === "ended"
                          ? `${fmtDaily(pace.dailySpentAvg)}/day`
                          : `${fmtDaily(pace.dailySafeToSpend)}/day`}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                        {pace.status === "active"
                          ? surplus >= 0
                            ? "safe to spend"
                            : "left to spend"
                          : pace.status === "upcoming"
                            ? "planned daily pace"
                            : "avg spent"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {pace.status === "active" && (
                          <>
                            · {pace.daysRemaining} {pace.daysRemaining === 1 ? "day" : "days"} left (Day {pace.daysElapsed} of {pace.totalDays})
                            {totalActual > 0 ? ` · ${fmtDaily(pace.dailySpentAvg)}/day spent` : ""}
                          </>
                        )}
                        {pace.status === "upcoming" && (
                          <>
                            · starts in {pace.daysUntilStart} {pace.daysUntilStart === 1 ? "day" : "days"} ({pace.totalDays} days)
                          </>
                        )}
                        {pace.status === "ended" && <>· {pace.totalDays}-day period ended</>}
                      </span>
                    </div>
                  )}

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
                    padding: "10px 12px",
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
                    flexShrink: 0,
                    alignSelf: "flex-start",
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
                        className="tap-target"
                        style={{ padding: "8px 14px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44 }}
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
                      className="tap-target"
                      style={{ padding: "8px 16px", background: "var(--accent-strong)", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--accent-text)", fontSize: 12, fontWeight: 600, cursor: busy ? "wait" : "pointer", minHeight: 44 }}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => { setHoursEditing(false); setHoursError(null); }}
                      className="tap-target"
                      style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 12, cursor: "pointer", minHeight: 44 }}
                    >
                      Cancel
                    </button>
                    {hoursError && <span style={{ fontSize: 12, color: "var(--danger-text)" }}>{hoursError}</span>}
                  </div>
                )}
              </div>
            )}

            {/* SECONDARY SUMMARY CARDS — always 3 equal columns */}
            <div className="metric-grid">
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
                <div key={c.label} className="metric-card">
                  <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.color, letterSpacing: "-0.3px" }}>{c.val}</div>
                  <div className="metric-card-sub">{c.sub ?? "\u00A0"}</div>
                </div>
              ))}
            </div>

            {/* ADD EXPENSE — desktop inline */}
            {!isLocked && categories.length > 0 && (
              <div className="hide-mobile" style={{ marginBottom: 4 }}>
                <AddExpenseForm
                  payPeriodId={activePeriod.id}
                  categories={categories}
                  onAdded={onRefresh}
                  draft={expenseDraft}
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
                  padding: "10px 16px",
                  cursor: "pointer",
                  gap: 10,
                  minHeight: 52,
                  flexWrap: "wrap",
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
                  {!isLocked && categories.length > 0 && (
                    <button
                      type="button"
                      className="tap-target"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCsvModalOpen(true);
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text-muted)",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "7px 10px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ↑ Import CSV
                    </button>
                  )}
                  {statementOpen && (
                    <select
                      value={statementFilter}
                      onChange={(e) => onStatementFilterChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Filter statement by category"
                      style={{
                        maxWidth: 180,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text-muted)",
                        fontSize: 12,
                        padding: "8px 8px",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, flexShrink: 0, padding: "0 2px" }}>
                    {statementOpen ? "▲" : "▼"}
                  </span>
                </div>
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
                  onAddExpense={!isLocked && categories.length > 0 ? () => setAddSheetOpen(true) : undefined}
                  onImportCsv={!isLocked && categories.length > 0 ? () => setCsvModalOpen(true) : undefined}
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
            {categories.length === 0 ? (
              <div style={{ background: "var(--bg-panel)", border: "1px dashed var(--border-strong)", borderRadius: 12, padding: 24, textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                  No budget categories yet. Add categories before logging expenses.
                </div>
                <Link
                  href="/admin"
                  className="tap-target"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--accent)",
                    background: "var(--accent-strong)",
                    color: "var(--accent-text)",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    minHeight: 44,
                  }}
                >
                  Manage Categories
                </Link>
              </div>
            ) : (
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
            )}
          </>
        )}
      </div>

      {csvModalOpen && activePeriod && !isLocked && (
        <CsvImportModal
          payPeriodId={activePeriod.id}
          periodLabel={periodLabel}
          fallbackDate={clampDateLocal(toLocalDateString(), activePeriod.start_date, activePeriod.end_date)}
          categories={categories}
          onImported={onRefresh}
          onClose={() => setCsvModalOpen(false)}
        />
      )}

      {/* Mobile FAB + bottom sheet for add expense */}
      {!isLocked && activePeriod && categories.length > 0 && (
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
              aria-label="Add expense"
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
                className="expense-sheet"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                    Add expense
                  </div>
                </div>
                <AddExpenseForm
                  payPeriodId={activePeriod.id}
                  categories={categories}
                  onAdded={onRefresh}
                  draft={expenseDraft}
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
