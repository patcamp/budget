"use client";

import { useState } from "react";
import { deleteExpense, updateExpense } from "@/components/api/expenses";
import { Category, Expense } from "@/lib/types";

interface Props {
  category: Category;
  categories: Category[];
  actual: number;
  expenses: Expense[];
  locked: boolean;
  onChanged: () => Promise<void>;
}

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

const editInputStyle: React.CSSProperties = {
  background: "#0F1825",
  border: "1px solid #1E293B",
  borderRadius: 5,
  color: "#E2E8F0",
  padding: "4px 6px",
  fontSize: 11,
  outline: "none",
};

export default function CategoryTile({ category, categories, actual, expenses, locked, onChanged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const budgeted = Number(category.budget_per_period);
  const over = actual > budgeted;
  // Cap at 105 so the bar renders visibly full when over budget rather than overflowing.
  const pct = budgeted > 0 ? Math.min(105, Math.round((actual / budgeted) * 100)) : 0;

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

  function startEdit(e: Expense) {
    setEditingId(e.id);
    setEditCategoryId(e.category_id);
    setEditAmount(String(Number(e.amount)));
    setEditDescription(e.description || "");
    setEditDate(e.expense_date);
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
              {expenses.map((e) => {
                if (editingId === e.id) {
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => ev.stopPropagation()}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 5,
                        background: "#080B12",
                        borderRadius: 6,
                        padding: "8px 10px",
                      }}
                    >
                      <select
                        value={editCategoryId}
                        onChange={(ev) => setEditCategoryId(ev.target.value)}
                        style={{ ...editInputStyle, flex: "1 1 100px" }}
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
                        onChange={(ev) => setEditAmount(ev.target.value)}
                        style={{ ...editInputStyle, width: 70 }}
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={editDescription}
                        onChange={(ev) => setEditDescription(ev.target.value)}
                        style={{ ...editInputStyle, flex: "1 1 100px" }}
                      />
                      <input
                        type="date"
                        value={editDate}
                        onChange={(ev) => setEditDate(ev.target.value)}
                        style={{ ...editInputStyle, flex: "1 1 120px" }}
                      />
                      <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
                        <button
                          onClick={() => handleSaveEdit(e.id)}
                          disabled={saving}
                          style={{
                            background: "#15803D",
                            border: "1px solid #166534",
                            borderRadius: 5,
                            color: "#fff",
                            cursor: saving ? "wait" : "pointer",
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "4px 8px",
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
                            borderRadius: 5,
                            color: "#94A3B8",
                            cursor: "pointer",
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "4px 8px",
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
                        <>
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              startEdit(e);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#475569",
                              cursor: "pointer",
                              fontSize: 12,
                              padding: "2px 4px",
                            }}
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleDelete(e.id);
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
