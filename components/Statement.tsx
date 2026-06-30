"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Category, Expense } from "@/lib/types";

interface Props {
  expenses: Expense[];
  categories: Category[];
  locked: boolean;
  onChanged: () => Promise<void>;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function Statement({ expenses, categories, locked, onChanged }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categoryById = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  const filteredExpenses = useMemo(
    () => (categoryFilter === "all" ? expenses : expenses.filter((e) => e.category_id === categoryFilter)),
    [expenses, categoryFilter]
  );

  const groups = useMemo(() => {
    const sorted = [...filteredExpenses].sort((a, b) => {
      if (a.expense_date !== b.expense_date) return b.expense_date.localeCompare(a.expense_date);
      return b.created_at.localeCompare(a.created_at);
    });
    const map = new Map<string, Expense[]>();
    for (const e of sorted) {
      const list = map.get(e.expense_date) || [];
      list.push(e);
      map.set(e.expense_date, list);
    }
    return Array.from(map.entries());
  }, [filteredExpenses]);

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

  const filterSelect = (
    <select
      value={categoryFilter}
      onChange={(e) => setCategoryFilter(e.target.value)}
      style={{
        background: "#080B12",
        border: "1px solid #1E293B",
        borderRadius: 7,
        color: "#E2E8F0",
        padding: "7px 10px",
        fontSize: 12,
        outline: "none",
      }}
    >
      <option value="all">All Categories</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  if (expenses.length === 0) {
    return (
      <div
        style={{
          background: "#0F1825",
          border: "1px solid #1E293B",
          borderRadius: 14,
          padding: 24,
          textAlign: "center",
          color: "#475569",
          fontSize: 12,
        }}
      >
        No transactions yet this period.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>{filterSelect}</div>
      <div style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 14, overflow: "hidden" }}>
        {groups.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#475569", fontSize: 12 }}>
            No transactions in this category.
          </div>
        )}
        {groups.map(([date, items]) => {
          const dayTotal = items.reduce((s, e) => s + Number(e.amount), 0);
          return (
          <div key={date}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "10px 16px",
                background: "#080B12",
                borderBottom: "1px solid #1E293B",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em" }}>
                {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div style={{ fontSize: 11, color: "#374151" }}>{fmt(dayTotal)}</div>
            </div>
            {items.map((e) => {
              const cat = categoryById[e.category_id];
              return (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderBottom: "1px solid #131D2E",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: cat?.color || "#475569",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#E2E8F0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {e.description || cat?.name || "Expense"}
                      </div>
                      <div style={{ fontSize: 10, color: "#475569" }}>{cat?.name || "Uncategorized"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9" }}>{fmt(Number(e.amount))}</div>
                    {!locked && (
                      <button
                        onClick={() => deleteExpense(e.id)}
                        disabled={deletingId === e.id}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#7F1D1D",
                          cursor: "pointer",
                          fontSize: 14,
                          padding: "2px 4px",
                        }}
                        title="Delete"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          );
        })}
      </div>
    </div>
  );
}
