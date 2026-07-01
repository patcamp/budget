"use client";

import { useEffect, useState, useCallback } from "react";
import { loadPageData } from "@/components/api/data";
import { PayPeriod, Category, Expense, PaycheckConfig, Investment } from "@/lib/types";
import Dashboard from "@/components/ui/Dashboard";
import Overview from "@/components/ui/Overview";
import AdminPanel from "@/components/ui/AdminPanel";
import InvestmentPanel from "@/components/ui/InvestmentPanel";

export default function Home() {
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paycheckConfig, setPaycheckConfig] = useState<PaycheckConfig | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"period" | "overview" | "investments" | "admin">("period");

  const loadAll = useCallback(async () => {
    setError(null);
    const pageData = await loadPageData();
    if (pageData.error) {
      setError(pageData.error);
      setLoading(false);
      return;
    }
    setPayPeriods(pageData.payPeriods);
    setCategories(pageData.categories);
    setExpenses(pageData.expenses);
    setPaycheckConfig(pageData.paycheckConfig);
    setInvestments(pageData.investments);
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
          { key: "investments" as const, label: "Investments" },
          { key: "admin" as const, label: "Admin" },
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
      {view === "period" && (
        <Dashboard
          payPeriods={payPeriods}
          categories={categories}
          expenses={expenses}
          onRefresh={loadAll}
        />
      )}
      {view === "overview" && (
        <Overview payPeriods={payPeriods} categories={categories} expenses={expenses} />
      )}
      {view === "investments" && (
        <InvestmentPanel investments={investments} onRefresh={loadAll} />
      )}
      {view === "admin" && (
        <AdminPanel
          config={paycheckConfig}
          payPeriods={payPeriods}
          categories={categories}
          expenses={expenses}
          onRefresh={loadAll}
        />
      )}
    </>
  );
}
