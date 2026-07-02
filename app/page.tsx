"use client";

import { useEffect, useState, useCallback } from "react";
import { loadPageData } from "@/components/api/data";
import { setupNewUser } from "@/components/api/onboarding";
import { getSession, onAuthChange, signOut, AuthSession } from "@/components/api/auth";
import { PayPeriod, Category, Expense, PaycheckConfig, Investment, Profile } from "@/lib/types";
import Dashboard from "@/components/ui/Dashboard";
import Overview from "@/components/ui/Overview";
import AdminPanel from "@/components/ui/AdminPanel";
import InvestmentPanel from "@/components/ui/InvestmentPanel";
import AuthScreen from "@/components/ui/AuthScreen";

export default function Home() {
  const [session, setSession] = useState<AuthSession | null>(null);
  // Distinguishes "checking localStorage for a session" from "signed out"
  // so the AuthScreen doesn't flash for already-signed-in users.
  const [authReady, setAuthReady] = useState(false);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paycheckConfig, setPaycheckConfig] = useState<PaycheckConfig | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"period" | "overview" | "investments" | "admin">("period");

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setAuthReady(true);
    });
    return onAuthChange(setSession);
  }, []);

  const loadAll = useCallback(async () => {
    if (!session) return;
    setError(null);
    let pageData = await loadPageData();
    // First-login onboarding: a fresh account has no categories and no
    // paycheck config — seed starter data (salary comes from the metadata
    // captured at registration), then refetch. Running this here instead
    // of at signup makes it work whether or not email confirmation is on.
    if (!pageData.error && pageData.categories.length === 0 && !pageData.paycheckConfig) {
      const meta = session.user.user_metadata ?? {};
      const num = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null);
      const setupError = await setupNewUser({
        pay_type: meta.pay_type === "hourly" ? "hourly" : "salary",
        annual_salary: num(meta.annual_salary),
        hourly_rate: num(meta.hourly_rate),
        night_diff_value: num(meta.night_diff_value),
        default_day_hours: num(meta.default_day_hours),
        default_night_hours: num(meta.default_night_hours),
      });
      if (setupError) {
        setError(setupError);
        setLoading(false);
        return;
      }
      pageData = await loadPageData();
    }
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
    setProfile(pageData.profile);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) {
      setLoading(true);
      loadAll();
    } else {
      // Signed out — drop the previous user's data from state.
      setPayPeriods([]);
      setCategories([]);
      setExpenses([]);
      setPaycheckConfig(null);
      setInvestments([]);
      setProfile(null);
      setView("period");
    }
  }, [session, loadAll]);

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

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
          you&apos;ve run supabase/schema.sql (including the multi-user migration) in your Supabase project.
        </div>
        <button
          onClick={() => signOut()}
          style={{ marginTop: 8, padding: "8px 18px", background: "transparent", border: "1px solid #1E293B", borderRadius: 8, color: "#94A3B8", fontSize: 12, cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>
    );
  }

  const displayName = profile?.full_name || session.user.email || "Account";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", background: "#080B12", borderBottom: "1px solid #1E293B" }}>
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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
          <span style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
            {displayName}
          </span>
          <button
            onClick={() => signOut()}
            style={{ padding: "5px 12px", background: "transparent", border: "1px solid #1E293B", borderRadius: 6, color: "#94A3B8", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
          >
            Sign out
          </button>
        </div>
      </div>
      {view === "period" && (
        <Dashboard
          payPeriods={payPeriods}
          categories={categories}
          expenses={expenses}
          profile={profile}
          paycheckConfig={paycheckConfig}
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
          profile={profile}
          onRefresh={loadAll}
        />
      )}
    </>
  );
}
