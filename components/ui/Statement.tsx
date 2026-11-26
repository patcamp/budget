"use client";

import { useMemo, useState } from "react";
import { deleteExpense, updateExpense } from "@/components/api/expenses";
import { matchesExpenseSearch } from "@/lib/pace";
import { Category, Expense } from "@/lib/types";
import { useToast } from "./Toast";

interface Props {
  expenses: Expense[];
  categories: Category[];
  locked: boolean;
  onChanged: () => Promise<void>;
  noCard?: boolean;
  categoryFilter?: string;
  onCategoryFilterChange?: (val: string) => void;
  onAddExpense?: () => void;
  onImportCsv?: () => void;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

const editInputStyle: React.CSSProperties = {
  background: "var(--bg-page)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-body)",
  padding: "6px 8px",
  fontSize: 12,
  outline: "none",
};

export default function Statement({
  expenses,
  categories,
  locked,
  onChanged,
  noCard = false,
  categoryFilter: controlledFilter,
  onCategoryFilterChange,
  onAddExpense,
  onImportCsv,
}: Props) {
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Supports both controlled (Dashboard passes filter via props) and
  // uncontrolled (standalone usage) modes.
  const [internalFilter, setInternalFilter] = useState("all");
  const categoryFilter = controlledFilter ?? internalFilter;
  const setCategoryFilter = onCategoryFilterChange ?? setInternalFilter;

  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== "all" && e.category_id !== categoryFilter) return false;
      if (searchQuery.trim() && !matchesExpenseSearch(e, categoryById[e.category_id]?.name, searchQuery)) {
        return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, searchQuery, categoryById]);

  const hasActiveFilter = categoryFilter !== "all" || searchQuery.trim().length > 0;

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
      toast.error(`Failed to delete expense: ${err}`);
      return;
    }
    toast.success("Expense deleted.");
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
    if (!editCategoryId || isNaN(numAmount) || numAmount === 0 || !editDate) {
      toast.error("Enter a valid category, non-zero amount, and date.");
      return;
    }

    setSaving(true);
    const err = await updateExpense(id, {
      category_id: editCategoryId,
      amount: numAmount,
      description: editDescription || null,
      expense_date: editDate,
    });
    setSaving(false);

    if (err) {
      toast.error(`Failed to save changes: ${err}`);
      return;
    }
    setEditingId(null);
    toast.success("Expense updated.");
    await onChanged();
  }

  const searchBar = expenses.length > 0 && (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--bg-panel)",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          background: "var(--bg-page)",
          border: "1px solid var(--border)",
          borderRadius: 7,
          overflow: "hidden",
        }}
      >
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search description or amount…"
          aria-label="Search statement by description or amount"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--text-body)",
            padding: "8px 10px",
            fontSize: 12,
            outline: "none",
            minWidth: 0,
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
            className="tap-target"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 16,
              padding: "4px 10px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        )}
      </div>
      {hasActiveFilter && (
        <span style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {filteredExpenses.length} of {expenses.length}
        </span>
      )}
    </div>
  );

  const emptyPeriodBlock = (
    <div style={{ padding: "26px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
        No expenses yet this period
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: !locked && (onAddExpense || onImportCsv) ? 14 : 0 }}>
        {locked
          ? "This period is locked with no recorded transactions."
          : "Log an expense above or import a bank/card CSV to get started."}
      </div>
      {!locked && (onAddExpense || onImportCsv) && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {onAddExpense && (
            <button
              type="button"
              onClick={onAddExpense}
              className="show-mobile tap-target"
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                border: "1px solid var(--accent)",
                background: "var(--accent-strong)",
                color: "var(--accent-text)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              + Add Expense
            </button>
          )}
          {onImportCsv && (
            <button
              type="button"
              onClick={onImportCsv}
              className="tap-target"
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              ↑ Import CSV
            </button>
          )}
        </div>
      )}
    </div>
  );

  const filterSelect = (
    <select
      value={categoryFilter}
      onChange={(e) => setCategoryFilter(e.target.value)}
      style={{
        background: "var(--bg-page)",
        border: "1px solid var(--border)",
        borderRadius: 7,
        color: "var(--text-body)",
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
      {searchBar}
      {expensesByDate.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>
          <div style={{ marginBottom: hasActiveFilter ? 10 : 0 }}>
            No matching transactions{searchQuery.trim() ? ` for "${searchQuery.trim()}"` : " in this category"}.
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("all");
              }}
              className="tap-target"
              style={{
                padding: "7px 14px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          )}
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
                alignItems: "center",
                padding: "10px 16px",
                background: "var(--bg-page)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>{fmt(dayTotal)}</div>
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
                      borderBottom: "1px solid var(--border-soft)",
                      gap: 8,
                      background: "var(--bg-page)",
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
                        className="tap-target"
                        style={{
                          background: "var(--accent-strong)",
                          border: "1px solid var(--accent)",
                          borderRadius: 6,
                          color: "var(--accent-text)",
                          cursor: saving ? "wait" : "pointer",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "6px 12px",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="tap-target"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "6px 12px",
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
                    padding: "12px 14px 12px 16px",
                    borderBottom: "1px solid var(--border-soft)",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: cat?.color || "var(--text-faint)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-body)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {expense.description || cat?.name || "Expense"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{cat?.name || "Uncategorized"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", paddingRight: 6, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(Number(expense.amount))}
                    </div>
                    {!locked && (
                      <>
                        <button
                          onClick={() => startEdit(expense)}
                          className="tap-target"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            fontSize: 15,
                            width: 40,
                            height: 40,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 8,
                          }}
                          title="Edit"
                          aria-label="Edit expense"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          className="tap-target"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#F87171",
                            cursor: "pointer",
                            fontSize: 20,
                            width: 40,
                            height: 40,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 8,
                            opacity: deletingId === expense.id ? 0.5 : 1,
                          }}
                          title="Delete"
                          aria-label="Delete expense"
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
    return <div>{expenses.length === 0 ? emptyPeriodBlock : rows}</div>;
  }

  if (expenses.length === 0) {
    return (
      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: 14,
        }}
      >
        {emptyPeriodBlock}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>{filterSelect}</div>
      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {rows}
      </div>
    </div>
  );
}
