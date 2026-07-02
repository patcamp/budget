"use client";

import { useState, useMemo } from "react";
import { upsertPaycheckConfig, applyConfigToOpenPeriods, applyHourlyConfigToOpenPeriods } from "@/components/api/admin";
import { updatePayPeriod, deletePayPeriodWithExpenses } from "@/components/api/periods";
import { addCategory, updateCategory, deleteCategory } from "@/components/api/categories";
import { updateProfile } from "@/components/api/auth";
import { hourlyGross, nightRate, computeBreakdown } from "@/lib/paycheck";
import { PaycheckConfig, Account, PayPeriod, Category, Expense, Profile } from "@/lib/types";

type AdminTab = "paycheck" | "periods" | "categories" | "profile";

interface Props {
  config: PaycheckConfig | null;
  payPeriods: PayPeriod[];
  categories: Category[];
  expenses: Expense[];
  profile: Profile | null;
  onRefresh: () => Promise<void>;
}

// ─── Paycheck types ───────────────────────────────────────────────────────────

interface FormState {
  pay_type: "salary" | "hourly";
  annual_salary: number;
  pay_periods_per_year: number;
  hourly_rate: number;
  night_diff_type: "flat" | "pct";
  night_diff_value: number;
  default_day_hours: number;
  default_night_hours: number;
  health_insurance_amount: number;
  hsa_amount: number;
  federal_tax_pct: number;
  state_tax_pct: number;
  fica_pct: number;
}

const DEFAULT_FORM: FormState = {
  pay_type: "salary",
  annual_salary: 60000,
  pay_periods_per_year: 24,
  hourly_rate: 0,
  night_diff_type: "flat",
  night_diff_value: 0,
  default_day_hours: 0,
  default_night_hours: 0,
  health_insurance_amount: 0,
  hsa_amount: 0,
  federal_tax_pct: 12.0,
  state_tax_pct: 5.0,
  fica_pct: 7.65,
};

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "d1", name: "Roth 401k", type: "post_tax", pct: 17 },
  { id: "d2", name: "Checking", type: "spending", pct: 65 },
  { id: "d3", name: "Savings", type: "other", pct: 25 },
  { id: "d4", name: "Brokerage", type: "other", pct: 10 },
];

const TYPE_LABEL: Record<Account["type"], string> = {
  pre_tax: "Pre-Tax Deduction",
  post_tax: "Post-Tax (Roth)",
  spending: "Spending",
  other: "Savings / Investment",
};

const TYPE_BASE: Record<Account["type"], string> = {
  pre_tax: "% of gross",
  post_tax: "% of gross",
  spending: "% of net",
  other: "% of net",
};

const TYPE_COLOR: Record<Account["type"], string> = {
  pre_tax: "#D97706",
  post_tax: "#A78BFA",
  spending: "#3B82F6",
  other: "#0891B2",
};

// Gross comes from salary ÷ periods, or from the default day/night hours for
// hourly users. The deduction/tax/net-split pipeline lives in lib/paycheck.ts
// (shared with the This Period hours editor).
function computeAmounts(f: FormState, accounts: Account[]) {
  const gross =
    f.pay_type === "hourly"
      ? hourlyGross(f.hourly_rate, f.night_diff_type, f.night_diff_value, f.default_day_hours, f.default_night_hours)
      : f.annual_salary / f.pay_periods_per_year;
  return computeBreakdown(gross, f, accounts);
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#080B12",
  border: "1px solid #1E293B",
  borderRadius: 6,
  color: "#F1F5F9",
  fontSize: 13,
  padding: "6px 10px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748B",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  display: "block",
  marginBottom: 4,
};

const panelStyle: React.CSSProperties = {
  background: "#0F1825",
  border: "1px solid #1E293B",
  borderRadius: 12,
  padding: 20,
};

const fmtMoney = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ─── Shared sub-components ───────────────────────────────────────────────────
// Defined at module scope (not inside AdminPanel) so React keeps a stable
// component identity across re-renders — a component redefined inside its
// parent's function body gets a new reference every render, which makes
// React remount its DOM (including any focused <input>) on every keystroke.

function NumField({ label, value, onChange, prefix, suffix, step = 0.01, min = 0 }: {
  label: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string; step?: number; min?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: "#080B12", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
        {prefix && <span style={{ padding: "6px 8px", color: "#475569", fontSize: 13, borderRight: "1px solid #1E293B", flexShrink: 0 }}>{prefix}</span>}
        <input
          type="number" step={step} min={min} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, padding: "6px 10px", outline: "none", width: 0 }}
        />
        {suffix && <span style={{ padding: "6px 8px", color: "#475569", fontSize: 12, borderLeft: "1px solid #1E293B", flexShrink: 0 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.15em", borderBottom: "1px solid #1E293B", paddingBottom: 8, marginBottom: 14 }}>
      {text}
    </div>
  );
}

function PreviewRow({ label, value, color = "#94A3B8", bold = false, indent = false }: {
  label: string; value: string; color?: string; bold?: boolean; indent?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", paddingLeft: indent ? 12 : 0 }}>
      <span style={{ fontSize: 12, color: indent ? "#475569" : "#64748B" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color }}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPanel({ config, payPeriods, categories, expenses, profile, onRefresh }: Props) {
  const [adminTab, setAdminTab] = useState<AdminTab>("paycheck");

  // ── Profile state ───────────────────────────────────────────────────────────
  const [profileDraft, setProfileDraft] = useState({
    full_name: profile?.full_name ?? "",
    company: profile?.company ?? "",
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Paycheck state ──────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(() =>
    config
      ? {
          pay_type: config.pay_type ?? "salary",
          annual_salary: Number(config.annual_salary),
          pay_periods_per_year: config.pay_periods_per_year,
          hourly_rate: Number(config.hourly_rate ?? 0),
          night_diff_type: config.night_diff_type ?? "flat",
          night_diff_value: Number(config.night_diff_value ?? 0),
          default_day_hours: Number(config.default_day_hours ?? 0),
          default_night_hours: Number(config.default_night_hours ?? 0),
          health_insurance_amount: Number(config.health_insurance_amount),
          hsa_amount: Number(config.hsa_amount),
          federal_tax_pct: Number(config.federal_tax_pct),
          state_tax_pct: Number(config.state_tax_pct),
          fica_pct: Number(config.fica_pct),
        }
      : { ...DEFAULT_FORM }
  );
  const [accounts, setAccounts] = useState<Account[]>(() =>
    config?.accounts?.length ? config.accounts : [...DEFAULT_ACCOUNTS]
  );
  const [paycheckBusy, setPaycheckBusy] = useState(false);
  const [paycheckStatus, setPaycheckStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  const amounts = useMemo(() => computeAmounts(form, accounts), [form, accounts]);
  const netAllocations = accounts.filter((a) => a.type === "spending" || a.type === "other");
  const netAllocationValid = netAllocations.length === 0 || Math.abs(amounts.netPct - 100) < 0.01;
  const hasSpending = accounts.some((a) => a.type === "spending");

  // ── Pay Periods state ───────────────────────────────────────────────────────
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodDraft, setPeriodDraft] = useState({ start_date: "", end_date: "", gross_amount: "", paycheck_amount: "" });
  const [confirmDeletePeriodId, setConfirmDeletePeriodId] = useState<string | null>(null);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // ── Categories state ────────────────────────────────────────────────────────
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", budget_per_period: "", is_fixed: false, color: "#3B82F6", sort_order: "", note: "" });
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", budget_per_period: "", is_fixed: false, color: "#3B82F6", note: "" });

  // ── Derived ─────────────────────────────────────────────────────────────────
  const expenseCountByPeriod = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) map[e.pay_period_id] = (map[e.pay_period_id] || 0) + 1;
    return map;
  }, [expenses]);

  const expenseCountByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) map[e.category_id] = (map[e.category_id] || 0) + 1;
    return map;
  }, [expenses]);

  const sortedPeriods = useMemo(
    () => [...payPeriods].sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [payPeriods]
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  // ── Paycheck handlers ────────────────────────────────────────────────────────
  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setPaycheckStatus(null);
  }

  function updateAccount(id: string, changes: Partial<Account>) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
    setPaycheckStatus(null);
  }

  async function savePaycheck() {
    if (netAllocations.length > 0 && !netAllocationValid) {
      setPaycheckStatus({ msg: `Spending + Savings must sum to 100% (currently ${amounts.netPct.toFixed(2)}%).`, ok: false });
      return;
    }
    if (!hasSpending) {
      setPaycheckStatus({ msg: "Add at least one Spending account.", ok: false });
      return;
    }
    setPaycheckBusy(true);
    setPaycheckStatus(null);
    const payload = { ...form, accounts, updated_at: new Date().toISOString() };
    const saveErr = await upsertPaycheckConfig(config?.id ?? null, payload);
    if (saveErr) { setPaycheckBusy(false); setPaycheckStatus({ msg: `Failed to save: ${saveErr}`, ok: false }); return; }
    const allocs = amounts.withAmounts.map((a) => ({ name: a.name, type: a.type, amount: Number(a.amount.toFixed(2)) }));
    // Hourly periods each keep their own actual hours, so gross is recomputed
    // per period instead of bulk-set to one value.
    const ppErr = form.pay_type === "hourly"
      ? await applyHourlyConfigToOpenPeriods(payload)
      : await applyConfigToOpenPeriods(amounts.gross, amounts.spending, allocs);
    setPaycheckBusy(false);
    if (ppErr) { setPaycheckStatus({ msg: `Config saved but failed to update open periods: ${ppErr}`, ok: false }); return; }
    setPaycheckStatus({ msg: "Saved and applied to all open periods.", ok: true });
    await onRefresh();
  }

  // ── Period handlers ──────────────────────────────────────────────────────────
  function startEditPeriod(p: PayPeriod) {
    setEditingPeriodId(p.id);
    setPeriodDraft({
      start_date: p.start_date,
      end_date: p.end_date,
      gross_amount: String(Number(p.gross_amount)),
      paycheck_amount: String(Number(p.paycheck_amount)),
    });
    setPeriodError(null);
  }

  async function savePeriod(id: string) {
    const payload = {
      start_date: periodDraft.start_date,
      end_date: periodDraft.end_date,
      gross_amount: parseFloat(periodDraft.gross_amount),
      paycheck_amount: parseFloat(periodDraft.paycheck_amount),
    };
    if (!payload.start_date || !payload.end_date) { setPeriodError("Start and end date are required."); return; }
    if (isNaN(payload.gross_amount) || isNaN(payload.paycheck_amount)) { setPeriodError("Amounts must be valid numbers."); return; }
    setPeriodBusy(true);
    const err = await updatePayPeriod(id, payload);
    setPeriodBusy(false);
    if (err) { setPeriodError(err); return; }
    setEditingPeriodId(null);
    await onRefresh();
  }

  async function confirmDeletePeriod(id: string) {
    setPeriodBusy(true);
    const err = await deletePayPeriodWithExpenses(id);
    setPeriodBusy(false);
    if (err) { setPeriodError(err); return; }
    setConfirmDeletePeriodId(null);
    await onRefresh();
  }

  // ── Category handlers ────────────────────────────────────────────────────────
  function startEditCategory(c: Category) {
    setEditingCategoryId(c.id);
    setCategoryDraft({
      name: c.name,
      budget_per_period: String(Number(c.budget_per_period)),
      is_fixed: c.is_fixed,
      color: c.color,
      sort_order: String(c.sort_order),
      note: c.note ?? "",
    });
    setCategoryError(null);
  }

  async function saveCategory(id: string) {
    if (!categoryDraft.name.trim()) { setCategoryError("Name is required."); return; }
    const budget = parseFloat(categoryDraft.budget_per_period);
    if (isNaN(budget) || budget < 0) { setCategoryError("Budget must be a valid number."); return; }
    setCategoryBusy(true);
    const err = await updateCategory(id, {
      name: categoryDraft.name.trim(),
      budget_per_period: budget,
      is_fixed: categoryDraft.is_fixed,
      color: categoryDraft.color,
      sort_order: parseInt(categoryDraft.sort_order) || 0,
      note: categoryDraft.note.trim() || null,
    });
    setCategoryBusy(false);
    if (err) { setCategoryError(err); return; }
    setEditingCategoryId(null);
    await onRefresh();
  }

  async function confirmDeleteCategory(id: string) {
    setCategoryBusy(true);
    const err = await deleteCategory(id);
    setCategoryBusy(false);
    if (err) { setCategoryError(err); return; }
    setConfirmDeleteCategoryId(null);
    await onRefresh();
  }

  async function handleAddCategory() {
    if (!newCategory.name.trim()) { setCategoryError("Name is required."); return; }
    const budget = parseFloat(newCategory.budget_per_period);
    if (isNaN(budget) || budget < 0) { setCategoryError("Budget must be a valid number."); return; }
    const maxSort = sortedCategories.reduce((m, c) => Math.max(m, c.sort_order), 0);
    setCategoryBusy(true);
    const err = await addCategory({
      name: newCategory.name.trim(),
      budget_per_period: budget,
      is_fixed: newCategory.is_fixed,
      color: newCategory.color,
      sort_order: maxSort + 1,
      note: newCategory.note.trim() || null,
      archived: false,
    });
    setCategoryBusy(false);
    if (err) { setCategoryError(err); return; }
    setNewCategory({ name: "", budget_per_period: "", is_fixed: false, color: "#3B82F6", note: "" });
    setAddingCategory(false);
    await onRefresh();
  }

  // ── Profile handlers ─────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!profile) return;
    if (!profileDraft.full_name.trim()) {
      setProfileStatus({ msg: "Name is required.", ok: false });
      return;
    }
    setProfileBusy(true);
    setProfileStatus(null);
    const err = await updateProfile(profile.id, {
      full_name: profileDraft.full_name.trim(),
      company: profileDraft.company.trim() || null,
    });
    setProfileBusy(false);
    if (err) { setProfileStatus({ msg: `Failed to save: ${err}`, ok: false }); return; }
    setProfileStatus({ msg: "Profile saved.", ok: true });
    await onRefresh();
  }

  // ── Sub-tab nav ──────────────────────────────────────────────────────────────
  const TABS: { key: AdminTab; label: string }[] = [
    { key: "paycheck", label: "Paycheck" },
    { key: "periods", label: "Pay Periods" },
    { key: "categories", label: "Categories" },
    { key: "profile", label: "Profile" },
  ];

  const selectStyle: React.CSSProperties = {
    background: "#080B12", border: "1px solid #1E293B", borderRadius: 6,
    color: "#F1F5F9", fontSize: 12, padding: "6px 8px", outline: "none", cursor: "pointer",
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "20px 24px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>Admin</div>
        <div style={{ fontSize: 12, color: "#475569" }}>Manage paycheck settings, pay periods, and spending categories.</div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1E293B", marginBottom: 24 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setAdminTab(t.key)}
            style={{
              padding: "9px 18px",
              border: "none",
              borderBottom: `2px solid ${adminTab === t.key ? "#3B82F6" : "transparent"}`,
              background: "transparent",
              color: adminTab === t.key ? "#F1F5F9" : "#64748B",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PAYCHECK TAB ────────────────────────────────────────────────────── */}
      {adminTab === "paycheck" && (
        <div className="paycheck-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={panelStyle}>
              <SectionLabel text="Pay" />
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {(["salary", "hourly"] as const).map((pt) => (
                  <button
                    key={pt}
                    onClick={() => setField("pay_type", pt)}
                    style={{
                      padding: "7px 18px",
                      borderRadius: 7,
                      border: `1px solid ${form.pay_type === pt ? "#3B82F6" : "#1E293B"}`,
                      background: form.pay_type === pt ? "#132038" : "transparent",
                      color: form.pay_type === pt ? "#F1F5F9" : "#64748B",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {pt === "salary" ? "Salary" : "Hourly"}
                  </button>
                ))}
              </div>
              {form.pay_type === "salary" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <NumField label="Annual Gross Salary" value={form.annual_salary} onChange={(v) => setField("annual_salary", v)} prefix="$" step={1} />
                  <NumField label="Pay Periods / Year" value={form.pay_periods_per_year} onChange={(v) => setField("pay_periods_per_year", v)} step={1} min={1} />
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <NumField label="Base Hourly Rate" value={form.hourly_rate} onChange={(v) => setField("hourly_rate", v)} prefix="$" />
                    <div>
                      <label style={labelStyle}>Night Differential</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", background: "#080B12", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden", flex: 1 }}>
                          {form.night_diff_type === "flat" && (
                            <span style={{ padding: "6px 8px", color: "#475569", fontSize: 13, borderRight: "1px solid #1E293B", flexShrink: 0 }}>$</span>
                          )}
                          <input
                            type="number" step={0.01} min={0} value={form.night_diff_value}
                            onChange={(e) => setField("night_diff_value", Number(e.target.value))}
                            style={{ flex: 1, background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, padding: "6px 10px", outline: "none", width: 0 }}
                          />
                          {form.night_diff_type === "pct" && (
                            <span style={{ padding: "6px 8px", color: "#475569", fontSize: 12, borderLeft: "1px solid #1E293B", flexShrink: 0 }}>%</span>
                          )}
                        </div>
                        <select
                          value={form.night_diff_type}
                          onChange={(e) => setField("night_diff_type", e.target.value as FormState["night_diff_type"])}
                          style={selectStyle}
                        >
                          <option value="flat">$ / hr</option>
                          <option value="pct">% of rate</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <NumField label="Day Hours / Period" value={form.default_day_hours} onChange={(v) => setField("default_day_hours", v)} step={0.25} />
                    <NumField label="Night Hours / Period" value={form.default_night_hours} onChange={(v) => setField("default_night_hours", v)} step={0.25} />
                    <NumField label="Pay Periods / Year" value={form.pay_periods_per_year} onChange={(v) => setField("pay_periods_per_year", v)} step={1} min={1} />
                  </div>
                  <div style={{ fontSize: 11, color: "#374151", marginTop: 10 }}>
                    Default schedule — actual hours are editable per pay period on the This Period tab.
                    Night rate: {fmtMoney(nightRate(form.hourly_rate, form.night_diff_type, form.night_diff_value))}/hr.
                  </div>
                </>
              )}
            </div>
            <div style={panelStyle}>
              <SectionLabel text="Tax Rates (effective, not marginal)" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <NumField label="Federal" value={form.federal_tax_pct} onChange={(v) => setField("federal_tax_pct", v)} suffix="%" />
                <NumField label="State" value={form.state_tax_pct} onChange={(v) => setField("state_tax_pct", v)} suffix="%" />
                <NumField label="FICA (SS + Medicare)" value={form.fica_pct} onChange={(v) => setField("fica_pct", v)} suffix="%" />
              </div>
              <div style={{ fontSize: 11, color: "#374151", marginTop: 10 }}>FICA standard: 7.65% (SS 6.2% + Medicare 1.45%). Use effective rates, not marginal.</div>
            </div>
            <div style={panelStyle}>
              <SectionLabel text="Flat Pre-Tax Deductions (per period)" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <NumField label="Health Insurance" value={form.health_insurance_amount} onChange={(v) => setField("health_insurance_amount", v)} prefix="$" />
                <NumField label="HSA" value={form.hsa_amount} onChange={(v) => setField("hsa_amount", v)} prefix="$" />
              </div>
            </div>
            <div style={panelStyle}>
              <SectionLabel text="Accounts" />
              <div className="scroll-x">
              <div className="scroll-x-content">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 190px 100px 28px", gap: 8, marginBottom: 8, minWidth: 400 }}>
                  <span style={{ fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</span>
                  <span style={{ fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>Type</span>
                  <span style={{ fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>Amount</span>
                  <span />
                </div>
                {accounts.map((acct) => (
                  <div key={acct.id} style={{ display: "grid", gridTemplateColumns: "1fr 190px 100px 28px", gap: 8, marginBottom: 8, alignItems: "center", minWidth: 400 }}>
                    <input type="text" value={acct.name} placeholder="Account name"
                      onChange={(e) => updateAccount(acct.id, { name: e.target.value })} style={{ ...inputStyle }} />
                    <select value={acct.type} onChange={(e) => updateAccount(acct.id, { type: e.target.value as Account["type"] })} style={selectStyle}>
                      <option value="pre_tax">Pre-Tax Deduction</option>
                      <option value="post_tax">Post-Tax (Roth)</option>
                      <option value="spending">Spending</option>
                      <option value="other">Savings / Investment</option>
                    </select>
                    <div style={{ display: "flex", alignItems: "center", background: "#080B12", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
                      <input type="number" step={0.01} min={0} value={acct.pct}
                        onChange={(e) => updateAccount(acct.id, { pct: Number(e.target.value) })}
                        style={{ flex: 1, background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, padding: "6px 6px", outline: "none", width: 0 }} />
                      <span style={{ fontSize: 10, color: "#374151", padding: "0 6px", flexShrink: 0 }}>%</span>
                    </div>
                    <button onClick={() => { setAccounts((p) => p.filter((a) => a.id !== acct.id)); setPaycheckStatus(null); }}
                      style={{ background: "none", border: "1px solid #1E293B", borderRadius: 6, color: "#475569", fontSize: 14, cursor: "pointer", width: 28, height: 32, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>×</button>
                  </div>
                ))}
                <div style={{ marginTop: 2, marginBottom: 12 }}>
                  {accounts.map((acct) => (
                    <div key={acct.id + "-h"} style={{ display: "grid", gridTemplateColumns: "1fr 190px 100px 28px", gap: 8, minWidth: 400 }}>
                      <span /><span style={{ fontSize: 10, color: TYPE_COLOR[acct.type], paddingLeft: 2 }}>{TYPE_LABEL[acct.type]}</span>
                      <span style={{ fontSize: 10, color: "#374151", paddingLeft: 6 }}>{TYPE_BASE[acct.type]}</span><span />
                    </div>
                  ))}
                </div>
              </div>
              </div>
              <button onClick={() => { setAccounts((p) => [...p, { id: crypto.randomUUID(), name: "", type: "other", pct: 0 }]); setPaycheckStatus(null); }}
                style={{ background: "none", border: "1px dashed #334155", borderRadius: 8, color: "#64748B", fontSize: 12, padding: "8px 16px", cursor: "pointer", width: "100%", textAlign: "center" }}>
                + Add Account
              </button>
              {netAllocations.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: netAllocationValid ? "#4ADE80" : "#F87171" }} />
                  <span style={{ fontSize: 11, color: netAllocationValid ? "#4ADE80" : "#F87171" }}>
                    Spending + Savings: {amounts.netPct.toFixed(2)}%{netAllocationValid ? " ✓" : " (must equal 100%)"}
                  </span>
                </div>
              )}
              {!hasSpending && accounts.length > 0 && (
                <div style={{ fontSize: 11, color: "#FBBF24", marginTop: 6 }}>No Spending account — add one so the dashboard has an income figure.</div>
              )}
            </div>
          </div>

          {/* Preview + save */}
          <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={panelStyle}>
              <SectionLabel text="Per-Period Preview" />
              {form.pay_type === "hourly" && (
                <>
                  <PreviewRow
                    label={`Day: ${form.default_day_hours} hr × ${fmtMoney(form.hourly_rate)}`}
                    value={fmtMoney(form.default_day_hours * form.hourly_rate)}
                    indent
                  />
                  <PreviewRow
                    label={`Night: ${form.default_night_hours} hr × ${fmtMoney(nightRate(form.hourly_rate, form.night_diff_type, form.night_diff_value))}`}
                    value={fmtMoney(form.default_night_hours * nightRate(form.hourly_rate, form.night_diff_type, form.night_diff_value))}
                    color="#A78BFA"
                    indent
                  />
                </>
              )}
              <PreviewRow label="Gross per Period" value={fmtMoney(amounts.gross)} color="#F1F5F9" />
              {amounts.preTaxTotal > 0 && (
                <>
                  {amounts.fixedPreTax > 0 && <PreviewRow label="Health / HSA" value={`–${fmtMoney(amounts.fixedPreTax)}`} indent />}
                  {amounts.withAmounts.filter((a) => a.type === "pre_tax").map((a) => (
                    <PreviewRow key={a.id} label={`${a.name} (${a.pct}%)`} value={`–${fmtMoney(a.amount)}`} indent />
                  ))}
                  <PreviewRow label="Taxable Income" value={fmtMoney(amounts.taxable)} color="#94A3B8" />
                </>
              )}
              <PreviewRow label={`Taxes (${(amounts.taxRate * 100).toFixed(2)}%)`} value={`–${fmtMoney(amounts.taxes)}`} color="#F87171" />
              {amounts.withAmounts.filter((a) => a.type === "post_tax").map((a) => (
                <PreviewRow key={a.id} label={`${a.name} (${a.pct}%)`} value={`–${fmtMoney(a.amount)}`} color="#A78BFA" indent />
              ))}
              <div style={{ borderTop: "1px solid #1E293B", margin: "8px 0" }} />
              <PreviewRow label="Net Take-Home" value={fmtMoney(amounts.net)} color="#4ADE80" bold />
              <div style={{ borderTop: "1px solid #1E293B", margin: "8px 0" }} />
              {amounts.withAmounts.filter((a) => a.type === "spending" || a.type === "other").map((a) => (
                <PreviewRow key={a.id} label={`→ ${a.name || "(unnamed)"} (${a.pct}%)`} value={fmtMoney(a.amount)} color={TYPE_COLOR[a.type]} indent />
              ))}
              {netAllocations.length === 0 && <div style={{ fontSize: 11, color: "#374151", padding: "4px 0" }}>No net allocations configured.</div>}
              <div style={{ borderTop: "1px solid #1E293B", margin: "8px 0" }} />
              <PreviewRow label="Gross check" value={fmtMoney(amounts.preTaxTotal + amounts.taxes + amounts.postTaxTotal + amounts.withAmounts.filter((a) => a.type === "spending" || a.type === "other").reduce((s, a) => s + a.amount, 0))} color="#475569" />
            </div>
            <button onClick={savePaycheck} disabled={paycheckBusy || (!netAllocationValid && netAllocations.length > 0) || !hasSpending}
              style={{ width: "100%", padding: "12px 20px", background: "#1D4ED8", border: "1px solid #3B82F6", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: paycheckBusy ? "wait" : "pointer", opacity: paycheckBusy || (!netAllocationValid && netAllocations.length > 0) || !hasSpending ? 0.5 : 1 }}>
              {paycheckBusy ? "Saving…" : "Save & Apply to Open Periods"}
            </button>
            {paycheckStatus && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: paycheckStatus.ok ? "#0D1F14" : "#1A0A0A", border: `1px solid ${paycheckStatus.ok ? "#166534" : "#7F1D1D"}`, fontSize: 12, color: paycheckStatus.ok ? "#4ADE80" : "#F87171" }}>
                {paycheckStatus.msg}
              </div>
            )}
            {config && <div style={{ fontSize: 11, color: "#374151", textAlign: "center" }}>Last updated: {new Date(config.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
          </div>
        </div>
      )}

      {/* ── PAY PERIODS TAB ──────────────────────────────────────────────────── */}
      {adminTab === "periods" && (
        <div>
          {periodError && (
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "#1A0A0A", border: "1px solid #7F1D1D", fontSize: 12, color: "#F87171" }}>
              {periodError}
            </div>
          )}
          {sortedPeriods.length === 0 && (
            <div style={{ ...panelStyle, textAlign: "center", color: "#475569", fontSize: 13 }}>No pay periods yet.</div>
          )}
          {sortedPeriods.length > 0 && (
            <div style={panelStyle}>
              <div className="scroll-x">
              <div className="scroll-x-content">
              {/* Table header */}
              <div className="admin-table-header periods-columns">
                {["Period", "Status", "Gross", "Paycheck", ""].map((h) => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
                ))}
              </div>

              {sortedPeriods.map((p) => {
                const isEditing = editingPeriodId === p.id;
                const isConfirmDelete = confirmDeletePeriodId === p.id;
                const expCount = expenseCountByPeriod[p.id] || 0;

                if (isEditing) {
                  return (
                    <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid #131D2E" }}>
                      <div className="period-edit-columns" style={{ display: "grid", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={labelStyle}>Start Date</label>
                          <input type="date" value={periodDraft.start_date} onChange={(e) => setPeriodDraft((d) => ({ ...d, start_date: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>End Date</label>
                          <input type="date" value={periodDraft.end_date} onChange={(e) => setPeriodDraft((d) => ({ ...d, end_date: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Gross ($)</label>
                          <input type="number" step="0.01" min="0" value={periodDraft.gross_amount} onChange={(e) => setPeriodDraft((d) => ({ ...d, gross_amount: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Paycheck ($)</label>
                          <input type="number" step="0.01" min="0" value={periodDraft.paycheck_amount} onChange={(e) => setPeriodDraft((d) => ({ ...d, paycheck_amount: e.target.value }))} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => savePeriod(p.id)} disabled={periodBusy}
                          style={{ padding: "6px 16px", background: "#1D4ED8", border: "1px solid #3B82F6", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: periodBusy ? "wait" : "pointer" }}>
                          {periodBusy ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => { setEditingPeriodId(null); setPeriodError(null); }}
                          style={{ padding: "6px 16px", background: "transparent", border: "1px solid #1E293B", borderRadius: 6, color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                if (isConfirmDelete) {
                  return (
                    <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid #131D2E", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#F87171" }}>
                        Delete {fmtDate(p.start_date)} – {fmtDate(p.end_date)}?
                        {expCount > 0 && <span style={{ color: "#FBBF24" }}> This will also delete {expCount} expense{expCount !== 1 ? "s" : ""}.</span>}
                      </span>
                      <button onClick={() => confirmDeletePeriod(p.id)} disabled={periodBusy}
                        style={{ padding: "5px 14px", background: "#7F1D1D", border: "1px solid #EF4444", borderRadius: 6, color: "#FCA5A5", fontSize: 12, fontWeight: 600, cursor: periodBusy ? "wait" : "pointer" }}>
                        {periodBusy ? "Deleting…" : "Delete"}
                      </button>
                      <button onClick={() => setConfirmDeletePeriodId(null)}
                        style={{ padding: "5px 14px", background: "transparent", border: "1px solid #1E293B", borderRadius: 6, color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={p.id} className="admin-row periods-columns">
                    <div>
                      <div style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 500 }}>
                        {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                      </div>
                      {expCount > 0 && <div style={{ fontSize: 10, color: "#374151", marginTop: 2 }}>{expCount} expense{expCount !== 1 ? "s" : ""}</div>}
                    </div>
                    <div data-label="Status">
                      <span style={{ fontSize: 11, fontWeight: 600, color: p.is_locked ? "#4ADE80" : "#FBBF24", background: p.is_locked ? "#0D1F14" : "#1C1408", border: `1px solid ${p.is_locked ? "#166534" : "#78350F"}`, borderRadius: 5, padding: "3px 8px" }}>
                        {p.is_locked ? "Locked" : "Open"}
                      </span>
                    </div>
                    <div data-label="Gross" style={{ fontSize: 13, color: "#94A3B8" }}>{fmtMoney(Number(p.gross_amount))}</div>
                    <div data-label="Paycheck" style={{ fontSize: 13, color: "#F1F5F9" }}>{fmtMoney(Number(p.paycheck_amount))}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEditPeriod(p)}
                        style={{ padding: "4px 10px", background: "transparent", border: "1px solid #1E293B", borderRadius: 5, color: "#94A3B8", fontSize: 11, cursor: "pointer" }}>
                        Edit
                      </button>
                      <button onClick={() => { setConfirmDeletePeriodId(p.id); setPeriodError(null); }}
                        style={{ padding: "4px 10px", background: "transparent", border: "1px solid #1E293B", borderRadius: 5, color: "#7F1D1D", fontSize: 11, cursor: "pointer" }}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORIES TAB ──────────────────────────────────────────────────── */}
      {adminTab === "categories" && (
        <div>
          {categoryError && (
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "#1A0A0A", border: "1px solid #7F1D1D", fontSize: 12, color: "#F87171" }}>
              {categoryError}
            </div>
          )}

          <div style={panelStyle}>
            <div className="scroll-x">
            <div className="scroll-x-content">
            {/* Table header */}
            <div className="admin-table-header categories-columns">
              {["Name", "Type", "Budget", "Order", "Txns", ""].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
              ))}
            </div>

            {sortedCategories.map((c) => {
              const isEditing = editingCategoryId === c.id;
              const isConfirmDelete = confirmDeleteCategoryId === c.id;
              const txnCount = expenseCountByCategory[c.id] || 0;
              const canDelete = txnCount === 0;

              if (isEditing) {
                return (
                  <div key={c.id} style={{ padding: "14px 0", borderBottom: "1px solid #131D2E" }}>
                    <div className="category-edit-columns" style={{ display: "grid", gap: 10, alignItems: "end", marginBottom: 10 }}>
                      <div>
                        <label style={labelStyle}>Color</label>
                        <input type="color" value={categoryDraft.color} onChange={(e) => setCategoryDraft((d) => ({ ...d, color: e.target.value }))}
                          style={{ width: 32, height: 32, border: "1px solid #1E293B", borderRadius: 6, background: "transparent", cursor: "pointer", padding: 2 }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Name</label>
                        <input type="text" value={categoryDraft.name} onChange={(e) => setCategoryDraft((d) => ({ ...d, name: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Type</label>
                        <select value={categoryDraft.is_fixed ? "fixed" : "variable"} onChange={(e) => setCategoryDraft((d) => ({ ...d, is_fixed: e.target.value === "fixed" }))} style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}>
                          <option value="variable">Variable</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Budget / Period</label>
                        <div style={{ display: "flex", alignItems: "center", background: "#080B12", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
                          <span style={{ padding: "6px 8px", color: "#475569", fontSize: 13, borderRight: "1px solid #1E293B" }}>$</span>
                          <input type="number" step="0.01" min="0" value={categoryDraft.budget_per_period} onChange={(e) => setCategoryDraft((d) => ({ ...d, budget_per_period: e.target.value }))}
                            style={{ flex: 1, background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, padding: "6px 8px", outline: "none", width: 0 }} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Order</label>
                        <input type="number" step="1" min="0" value={categoryDraft.sort_order} onChange={(e) => setCategoryDraft((d) => ({ ...d, sort_order: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={labelStyle}>Note (optional)</label>
                      <input type="text" value={categoryDraft.note} placeholder="Description shown in category tile" onChange={(e) => setCategoryDraft((d) => ({ ...d, note: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveCategory(c.id)} disabled={categoryBusy}
                        style={{ padding: "6px 16px", background: "#1D4ED8", border: "1px solid #3B82F6", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: categoryBusy ? "wait" : "pointer" }}>
                        {categoryBusy ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => { setEditingCategoryId(null); setCategoryError(null); }}
                        style={{ padding: "6px 16px", background: "transparent", border: "1px solid #1E293B", borderRadius: 6, color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              if (isConfirmDelete) {
                return (
                  <div key={c.id} style={{ padding: "14px 0", borderBottom: "1px solid #131D2E", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "#F87171" }}>Delete "{c.name}"? This cannot be undone.</span>
                    <button onClick={() => confirmDeleteCategory(c.id)} disabled={categoryBusy}
                      style={{ padding: "5px 14px", background: "#7F1D1D", border: "1px solid #EF4444", borderRadius: 6, color: "#FCA5A5", fontSize: 12, fontWeight: 600, cursor: categoryBusy ? "wait" : "pointer" }}>
                      {categoryBusy ? "Deleting…" : "Delete"}
                    </button>
                    <button onClick={() => setConfirmDeleteCategoryId(null)}
                      style={{ padding: "5px 14px", background: "transparent", border: "1px solid #1E293B", borderRadius: 6, color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                );
              }

              return (
                <div key={c.id} className="admin-row categories-columns">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: c.color, border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 500 }}>{c.name}</span>
                  </div>
                  <div data-label="Type" style={{ fontSize: 11, color: c.is_fixed ? "#A78BFA" : "#64748B" }}>{c.is_fixed ? "Fixed" : "Variable"}</div>
                  <div data-label="Budget" style={{ fontSize: 13, color: "#94A3B8" }}>{fmtMoney(Number(c.budget_per_period))}</div>
                  <div data-label="Order" style={{ fontSize: 12, color: "#475569" }}>{c.sort_order}</div>
                  <div data-label="Txns" style={{ fontSize: 12, color: txnCount > 0 ? "#64748B" : "#374151" }}>
                    {txnCount > 0 ? `${txnCount} txn${txnCount !== 1 ? "s" : ""}` : "—"}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEditCategory(c)}
                      style={{ padding: "4px 10px", background: "transparent", border: "1px solid #1E293B", borderRadius: 5, color: "#94A3B8", fontSize: 11, cursor: "pointer" }}>
                      Edit
                    </button>
                    <button
                      onClick={() => canDelete ? (setConfirmDeleteCategoryId(c.id), setCategoryError(null)) : undefined}
                      disabled={!canDelete}
                      title={!canDelete ? `Cannot delete — ${txnCount} transaction${txnCount !== 1 ? "s" : ""} exist` : "Delete category"}
                      style={{ padding: "4px 10px", background: "transparent", border: "1px solid #1E293B", borderRadius: 5, color: canDelete ? "#7F1D1D" : "#2D1B1B", fontSize: 11, cursor: canDelete ? "pointer" : "not-allowed", opacity: canDelete ? 1 : 0.4 }}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
            </div>

            {/* Add category */}
            {!addingCategory ? (
              <button onClick={() => { setAddingCategory(true); setCategoryError(null); }}
                style={{ marginTop: 14, background: "none", border: "1px dashed #334155", borderRadius: 8, color: "#64748B", fontSize: 12, padding: "9px 16px", cursor: "pointer", width: "100%", textAlign: "center" }}>
                + Add Category
              </button>
            ) : (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1E293B" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>New Category</div>
                <div className="category-edit-columns" style={{ display: "grid", gap: 10, alignItems: "end", marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Color</label>
                    <input type="color" value={newCategory.color} onChange={(e) => setNewCategory((n) => ({ ...n, color: e.target.value }))}
                      style={{ width: 32, height: 32, border: "1px solid #1E293B", borderRadius: 6, background: "transparent", cursor: "pointer", padding: 2 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input type="text" value={newCategory.name} placeholder="e.g. Groceries" onChange={(e) => setNewCategory((n) => ({ ...n, name: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select value={newCategory.is_fixed ? "fixed" : "variable"} onChange={(e) => setNewCategory((n) => ({ ...n, is_fixed: e.target.value === "fixed" }))} style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}>
                      <option value="variable">Variable</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Budget / Period</label>
                    <div style={{ display: "flex", alignItems: "center", background: "#080B12", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
                      <span style={{ padding: "6px 8px", color: "#475569", fontSize: 13, borderRight: "1px solid #1E293B" }}>$</span>
                      <input type="number" step="0.01" min="0" value={newCategory.budget_per_period} placeholder="0.00" onChange={(e) => setNewCategory((n) => ({ ...n, budget_per_period: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, padding: "6px 8px", outline: "none", width: 0 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#374151", paddingBottom: 8 }}>Sort: auto</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Note (optional)</label>
                  <input type="text" value={newCategory.note} placeholder="Description shown in category tile" onChange={(e) => setNewCategory((n) => ({ ...n, note: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleAddCategory} disabled={categoryBusy}
                    style={{ padding: "7px 18px", background: "#1D4ED8", border: "1px solid #3B82F6", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: categoryBusy ? "wait" : "pointer" }}>
                    {categoryBusy ? "Adding…" : "Add Category"}
                  </button>
                  <button onClick={() => { setAddingCategory(false); setCategoryError(null); setNewCategory({ name: "", budget_per_period: "", is_fixed: false, color: "#3B82F6", note: "" }); }}
                    style={{ padding: "7px 16px", background: "transparent", border: "1px solid #1E293B", borderRadius: 6, color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PROFILE TAB ─────────────────────────────────────────────────────── */}
      {adminTab === "profile" && (
        <div style={{ maxWidth: 480 }}>
          {!profile ? (
            <div style={{ ...panelStyle, textAlign: "center", color: "#475569", fontSize: 13 }}>
              No profile found. Make sure the multi-user migration in supabase/schema.sql has been run.
            </div>
          ) : (
            <div style={{ ...panelStyle, display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionLabel text="Your Profile" />
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={profile.email} disabled
                  style={{ ...inputStyle, color: "#64748B", cursor: "not-allowed" }} />
                <div style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>Email is your login and can&apos;t be changed here.</div>
              </div>
              <div>
                <label style={labelStyle}>Name</label>
                <input type="text" value={profileDraft.full_name}
                  onChange={(e) => { setProfileDraft((d) => ({ ...d, full_name: e.target.value })); setProfileStatus(null); }}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input type="text" value={profileDraft.company} placeholder="Optional"
                  onChange={(e) => { setProfileDraft((d) => ({ ...d, company: e.target.value })); setProfileStatus(null); }}
                  style={inputStyle} />
              </div>
              <button onClick={saveProfile} disabled={profileBusy}
                style={{ padding: "10px 20px", background: "#1D4ED8", border: "1px solid #3B82F6", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: profileBusy ? "wait" : "pointer", opacity: profileBusy ? 0.6 : 1 }}>
                {profileBusy ? "Saving…" : "Save Profile"}
              </button>
              {profileStatus && (
                <div style={{ padding: "9px 12px", borderRadius: 8, background: profileStatus.ok ? "#0D1F14" : "#1A0A0A", border: `1px solid ${profileStatus.ok ? "#166534" : "#7F1D1D"}`, fontSize: 12, color: profileStatus.ok ? "#4ADE80" : "#F87171" }}>
                  {profileStatus.msg}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#374151" }}>
                Member since {new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
