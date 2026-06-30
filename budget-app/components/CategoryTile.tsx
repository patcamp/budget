"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Category, Expense } from "@/lib/types";

interface Props {
  category: Category;
  actual: number;
  expenses: Expense[];
  locked: boolean;
  onChanged: () => Promise<void>;
}

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function CategoryTile({ category, actual, expenses, locked, onChanged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const budgeted = Number(category.budget_per_period);
  const over = actual > budgeted;
  const pct = budgeted > 0 ? Math.min(105, Math.round((actual / budgeted) * 100)) : 0;

  async function deleteExpense(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    await onChanged();
  }

  return (
    <div
      style={{
        background: "#0F1825",
        border: `1px solid ${over ? "#450A0A" : expanded ? category.color + "44" : "#1E293B"}`,
        borderRadius: 10,
        padding: "14px 16px",
        transition: "border-color 0.15s",
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, cursor: "pointer" }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1" }}>{category.name}</div>
          <div style={{ fontSize: 10, color: "#374151", marginTop: 2 }}>
            {category.is_fixed ? "● Fixed" : "○ Variable"} · {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: over ? "#F87171" : "#F1F5F9" }}>{fmt(actual)}</div>
          <div style={{ fontSize: 10, color: "#475569" }}>of {fmt(budgeted)}</div>
        </div>
      </div>

      <div style={{ height: 4, background: "#1E293B", borderRadius: 2 }}>
        <div
          style={{
            height: "100%",
            borderRadius: 2,
            width: `${pct}%`,
            background: over ? "#EF4444" : category.color,
            transition: "width 0.3s",
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: over ? "#EF4444" : "#4ADE80", marginTop: 6 }}>
        {over ? `▲ ${fmt(actual - budgeted)} over` : `▼ ${fmt(budgeted - actual)} under`}
      </div>

      {category.note && (
        <div
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 10, color: "#374151", marginTop: 8, cursor: "pointer" }}
        >
          {expanded ? "▲ hide" : "▼ details"}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 10, borderTop: "1px solid #1E293B", paddingTop: 10 }}>
          {category.note && (
            <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6, marginBottom: expenses.length ? 10 : 0 }}>
              {category.note}
            </div>
          )}
          {expenses.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {expenses.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 11,
                    color: "#94A3B8",
                    background: "#080B12",
                    borderRadius: 6,
                    padding: "6px 10px",
                  }}
                >
                  <div>
                    <span style={{ color: "#CBD5E1", fontWeight: 600 }}>{fmt(Number(e.amount))}</span>
                    {e.description && <span> — {e.description}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#374151" }}>
                      {new Date(e.expense_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    {!locked && (
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          deleteExpense(e.id);
                        }}
                        disabled={deletingId === e.id}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#7F1D1D",
                          cursor: "pointer",
                          fontSize: 13,
                          padding: "2px 4px",
                        }}
                        title="Delete"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
