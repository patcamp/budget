"use client";

import { useEffect, useRef, useState } from "react";
import { addExpense } from "@/components/api/expenses";
import { Category } from "@/lib/types";
import { toLocalDateString } from "@/lib/dates";

interface Props {
  payPeriodId: string;
  categories: Category[];
  onAdded: () => Promise<void>;
  /** stacked = amount-first column layout (mobile sheet). inline = desktop row. */
  layout?: "inline" | "stacked";
  onClose?: () => void;
  autoFocusAmount?: boolean;
}

export default function AddExpenseForm({
  payPeriodId,
  categories,
  onAdded,
  layout = "inline",
  onClose,
  autoFocusAmount = false,
}: Props) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => toLocalDateString());
  const [submitting, setSubmitting] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocusAmount) return;
    const el = amountRef.current;
    if (!el) return;
    // Defer so the sheet is painted before focus — avoids iOS focusing
    // behind the keyboard accessory and leaving the caret mid-placeholder.
    const t = window.setTimeout(() => {
      el.focus();
      el.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, [autoFocusAmount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!categoryId || isNaN(numAmount) || numAmount === 0) return;

    setSubmitting(true);
    setError(null);
    const err = await addExpense({
      pay_period_id: payPeriodId,
      category_id: categoryId,
      amount: numAmount,
      description: description || null,
      expense_date: date,
    });
    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }

    setAmount("");
    setDescription("");
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
    await onAdded();
    onClose?.();
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-page)",
    border: "1px solid var(--border)",
    borderRadius: 7,
    color: "var(--text-body)",
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    width: layout === "stacked" ? "100%" : undefined,
    boxSizing: "border-box",
    textAlign: "left",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };

  const stacked = layout === "stacked";

  const amountValid = (() => {
    const n = parseFloat(amount);
    return !!categoryId && !isNaN(n) && n !== 0;
  })();

  const actions = (
    <>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: stacked ? 1 : undefined,
            padding: stacked ? "14px 18px" : "9px 18px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: stacked ? 48 : undefined,
          }}
        >
          Cancel
        </button>
      )}
      <button
        type="submit"
        disabled={submitting || (stacked && !amountValid)}
        style={{
          flex: stacked ? 2 : undefined,
          padding: stacked ? "14px 20px" : "9px 20px",
          borderRadius: 8,
          border: "1px solid var(--accent-strong)",
          background: justAdded ? "#15803D" : "var(--accent-strong)",
          color: justAdded ? "#ffffff" : "var(--accent-text)",
          fontSize: 14,
          fontWeight: 700,
          cursor: submitting ? "wait" : "pointer",
          opacity: submitting || (stacked && !amountValid) ? 0.55 : 1,
          transition: "background 0.2s, opacity 0.15s",
          minHeight: stacked ? 48 : undefined,
        }}
      >
        {justAdded ? "Added ✓" : submitting ? "Adding…" : "Add Expense"}
      </button>
    </>
  );

  const fields = (
    <>
      {stacked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Amount</label>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            enterKeyHint="next"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              const next = e.target.value.replace(/[^0-9.]/g, "");
              // Allow at most one decimal and two fractional digits.
              if ((next.match(/\./g) || []).length > 1) return;
              const [, frac] = next.split(".");
              if (frac && frac.length > 2) return;
              setAmount(next);
            }}
            onFocus={(e) => e.target.select()}
            style={{
              ...inputStyle,
              fontSize: 28,
              fontWeight: 700,
              padding: "14px 16px",
              letterSpacing: "-0.5px",
            }}
            required
            aria-label="Amount"
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: stacked ? undefined : 160, width: stacked ? "100%" : undefined }}>
        <label style={labelStyle}>Category</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!stacked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 110 }}>
          <label style={labelStyle}>Amount</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
            required
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: stacked ? undefined : "1 1 180px", width: stacked ? "100%" : undefined }}>
        <label style={labelStyle}>Description (optional)</label>
        <input
          type="text"
          placeholder="e.g. dinner out"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: stacked ? "100%" : 145 }}>
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...inputStyle, textAlign: "left" }}
          required
        />
      </div>

      {error && (
        <div style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--danger-bg)", border: "1px solid var(--danger-border)", fontSize: 12, color: "var(--danger-text)" }}>
          {error}
        </div>
      )}
    </>
  );

  if (stacked) {
    return (
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <div className="expense-sheet-body" style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {fields}
        </div>
        <div className="expense-sheet-actions">{actions}</div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      {fields}
      <div style={{ display: "flex", gap: 8 }}>{actions}</div>
    </form>
  );
}
