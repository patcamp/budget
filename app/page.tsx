"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PayPeriod, Category, Expense } from "@/lib/types";
import Dashboard from "@/components/Dashboard";
import Overview from "@/components/Overview";

export default function Home() {
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"period" | "overview">("period");

  const loadAll = useCallback(async () => {
    setError(null);
    const [ppRes, catRes, expRes] = await Promise.all([
      supabase.from("pay_periods").select("*").order("start_date", { ascending: true }),
      supabase.from("categories").select("*").eq("archived", false).order("sort_order", { ascending: true }),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    ]);

    if (ppRes.error || catRes.error || expRes.error) {
      setError(
        ppRes.error?.message || catRes.error?.message || expRes.error?.message || "Failed to load data"
      );
      setLoading(false);
      return;
    }

    setPayPeriods(ppRes.data || []);
    setCategories(catRes.data || []);
    setExpenses(expRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
        Loading your budget…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#F87171", padding: 24, textAlign: "center", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Couldn&apos;t load data</div>
        <div style={{ fontSize: 13, color: "#94A3B8", maxWidth: 480 }}>{error}</div>
        <div style={{ fontSize: 12, color: "#475569", maxWidth: 480 }}>
          Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly, and that
          you&apos;ve run supabase/schema.sql in your Supabase project.
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", background: "#080B12", borderBottom: "1px solid #1E293B" }}>
        {[
          { key: "period" as const, label: "This Period" },
          { key: "overview" as const, label: "Overview" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom: `2px solid ${view === tab.key ? "#3B82F6" : "transparent"}`,
              background: "transparent",
              color: view === tab.key ? "#F1F5F9" : "#64748B",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {view === "period" ? (
        <Dashboard
          payPeriods={payPeriods}
          categories={categories}
          expenses={expenses}
          onRefresh={loadAll}
        />
      ) : (
        <Overview payPeriods={payPeriods} categories={categories} expenses={expenses} />
      )}
    </>
  );
}
