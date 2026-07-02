"use client";

import { useMemo, useState } from "react";
import { deleteExpense, updateExpense } from "@/components/api/expenses";
import { Category, Expense } from "@/lib/types";

interface Props {
  expenses: Expense[];
  categories: Category[];
  locked: boolean;
  onChanged: () => Promise<void>;
  noCard?: boolean;
  categoryFilter?: string;
  onCategoryFilterChange?: (val: string) => void;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

const editInputStyle: React.CSSProperties = {
  background: "#080B12",
  border: "1px solid #1E293B",
  borderRadius: 6,
  color: "#E2E8F0",
  padding: "6px 8px",
  fontSize: 12,
  outline: "none",
};

export default function Statement({ expenses, categories, locked, onChanged, noCard = false, categoryFilter: controlledFilter, onCategoryFilterChange }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Supports both controlled (Dashboard passes filter via props) and
  // uncontrolled (standalone usage) modes.
  const [internalFilter, setInternalFilter] = useState("all");
  const categoryFilter = controlledFilter ?? internalFilter;
  const setCategoryFilter = onCategoryFilterChange ?? setInternalFilter;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const categoryById = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  const filteredExpenses = useMemo(
    () => (categoryFilter === "all" ? expenses : expenses.filter((e) => e.category_id === categoryFilter)),
    [expenses, categoryFilter]
  );

  // Expenses sorted newest-first, then grouped by date for the statement view
  const expensesByDate = useMemo((): [string, Expense[]][] => {
    const sorted = [...filteredExpenses].sort((a, b) => {
      if (a.expense_date !== b.expense_date) return b.expense_date.localeCompare(a.expense_date);
      return b.created_at.localeCompare(a.created_at);
    });
    const byDate = new Map<string, Expense[]>();
    for (const expense of sorted) {
      const existing = byDate.get(expense.expense_date) || [];
      existing.push(expense);
      byDate.set(expense.expense_date, existing);
    }
    return Array.from(byDate.entries());
  }, [filteredExpenses]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const err = await deleteExpense(id);
    setDeletingId(null);
    if (err) {
      alert(`Failed to delete: ${err}`);
      return;
    }
    await onChanged();
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setEditCategoryId(expense.category_id);
    setEditAmount(String(Number(expense.amount)));
    setEditDescription(expense.description || "");
    setEditDate(expense.expense_date);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(id: string) {
    const numAmount = parseFloat(editAmount);
    if (!editCategoryId || isNaN(numAmount) || numAmount === 0 || !editDate) return;

    setSaving(true);
    const err = await updateExpense(id, {
      category_id: editCategoryId,
      amount: numAmount,
      description: editDescription || null,
      expense_date: editDate,
    });
    setSaving(false);

    if (err) {
      alert(`Failed to save changes: ${err}`);
      return;
    }
    setEditingId(null);
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

  const rows = (
    <>
      {expensesByDate.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "#475569", fontSize: 12 }}>
          No transactions in this category.
        </div>
      )}
      {expensesByDate.map(([date, items]) => {
        const dayTotal = items.reduce((sum, expense) => sum + Number(expense.amount), 0);
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
            {items.map((expense) => {
              const cat = categoryById[expense.category_id];

              if (editingId === expense.id) {
                return (
                  <div
                    key={expense.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      padding: "10px 16px",
                      borderBottom: "1px solid #131D2E",
                      gap: 8,
                      background: "#0B131F",
                    }}
                  >
                    <select
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                      style={editInputStyle}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      style={{ ...editInputStyle, width: 90 }}
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      style={{ ...editInputStyle, flex: "1 1 140px", minWidth: 100 }}
                    />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      style={editInputStyle}
                    />
                    <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                      <button
                        onClick={() => handleSaveEdit(expense.id)}
                        disabled={saving}
                        style={{
                          background: "#15803D",
                          border: "1px solid #166534",
                          borderRadius: 6,
                          color: "#fff",
                          cursor: saving ? "wait" : "pointer",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "6px 10px",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        style={{
                          background: "transparent",
                          border: "1px solid #1E293B",
                          borderRadius: 6,
                          color: "#94A3B8",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "6px 10px",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={expense.id}
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
                        {expense.description || cat?.name || "Expense"}
                      </div>
                      <div style={{ fontSize: 10, color: "#475569" }}>{cat?.name || "Uncategorized"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9" }}>{fmt(Number(expense.amount))}</div>
                    {!locked && (
                      <>
                        <button
                          onClick={() => startEdit(expense)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#64748B",
                            cursor: "pointer",
                            fontSize: 13,
                            padding: "2px 4px",
                          }}
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
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
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );

  if (noCard) {
    return (
      <div>
        {expenses.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#475569", fontSize: 12 }}>
            No transactions yet this period.
          </div>
        ) : (
          rows
        )}
      </div>
    );
  }

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
        {rows}
      </div>
    </div>
  );
}
