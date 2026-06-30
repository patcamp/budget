"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Category } from "@/lib/types";

interface Props {
  payPeriodId: string;
  categories: Category[];
  onAdded: () => Promise<void>;
}

export default function AddExpenseForm({ payPeriodId, categories, onAdded }: Props) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!categoryId || isNaN(numAmount) || numAmount === 0) return;

    setSubmitting(true);
    const { error } = await supabase.from("expenses").insert({
      pay_period_id: payPeriodId,
      category_id: categoryId,
      amount: numAmount,
      description: description || null,
      expense_date: date,
    });
    setSubmitting(false);

    if (error) {
      alert(`Failed to add expense: ${error.message}`);
      return;
    }

    setAmount("");
    setDescription("");
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
    await onAdded();
  }

  const inputStyle: React.CSSProperties = {
    background: "#080B12",
    border: "1px solid #1E293B",
    borderRadius: 7,
    color: "#E2E8F0",
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#0F1825",
        border: "1px solid #1E293B",
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
        <label style={{ fontSize: 10, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Category</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 110 }}>
        <label style={{ fontSize: 10, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Amount</label>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
        <label style={{ fontSize: 10, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description (optional)</label>
        <input
          type="text"
          placeholder="e.g. El Rey dinner"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 145 }}>
        <label style={{ fontSize: 10, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} required />
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "9px 20px",
          borderRadius: 7,
          border: "1px solid #1D4ED8",
          background: justAdded ? "#15803D" : "#1D4ED8",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: submitting ? "wait" : "pointer",
          opacity: submitting ? 0.6 : 1,
          transition: "background 0.2s",
        }}
      >
        {justAdded ? "Added ✓" : submitting ? "Adding…" : "Add Expense"}
      </button>
    </form>
  );
}
