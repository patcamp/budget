"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadPageData, PageData } from "@/components/api/data";
import { setupNewUser } from "@/components/api/onboarding";
import { getSession, onAuthChange, signOut, AuthSession } from "@/components/api/auth";
import { isValidTheme } from "@/lib/themes";
import AuthScreen from "@/components/ui/AuthScreen";

interface BudgetData extends PageData {
  onRefresh: () => Promise<void>;
}

const BudgetDataContext = createContext<BudgetData | null>(null);

export function useBudgetData(): BudgetData {
  const ctx = useContext(BudgetDataContext);
  if (!ctx) throw new Error("useBudgetData must be used within the (app) layout");
  return ctx;
}

const TABS = [
  { href: "/", label: "This Period" },
  { href: "/overview", label: "Overview" },
  { href: "/investments", label: "Investments" },
  { href: "/admin", label: "Admin" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  // Distinguishes "checking localStorage for a session" from "signed out"
  // so the AuthScreen doesn't flash for already-signed-in users.
  const [authReady, setAuthReady] = useState(false);
  const [payPeriods, setPayPeriods] = useState<PageData["payPeriods"]>([]);
  const [categories, setCategories] = useState<PageData["categories"]>([]);
  const [expenses, setExpenses] = useState<PageData["expenses"]>([]);
  const [paycheckConfig, setPaycheckConfig] = useState<PageData["paycheckConfig"]>(null);
  const [investments, setInvestments] = useState<PageData["investments"]>([]);
  const [profile, setProfile] = useState<PageData["profile"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    }
  }, [session, loadAll]);

  // Applies the signed-in user's saved theme and keeps the localStorage
  // cache (read synchronously in app/layout.tsx, before hydration) in
  // sync so the next page load/AuthScreen paints in the right theme
  // immediately instead of flashing dark first.
  useEffect(() => {
    const theme = profile?.theme && isValidTheme(profile.theme) ? profile.theme : null;
    if (!theme) return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("budget-theme", theme);
  }, [profile]);

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
        Loading your budget…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#F87171", padding: 24, textAlign: "center", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Couldn&apos;t load data</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 480 }}>{error}</div>
        <div style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 480 }}>
          Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly, and that
          you&apos;ve run supabase/schema.sql (including the multi-user migration) in your Supabase project.
        </div>
        <button
          onClick={() => signOut()}
          style={{ marginTop: 8, padding: "8px 18px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>
    );
  }

  const displayName = profile?.full_name || session.user.email || "Account";

  return (
    <BudgetDataContext.Provider
      value={{ payPeriods, categories, expenses, paycheckConfig, investments, profile, error: null, onRefresh: loadAll }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", background: "var(--bg-page)", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="header-tab"
            style={{
              display: "inline-block",
              border: "none",
              borderBottom: `2px solid ${pathname === tab.href ? "var(--accent)" : "transparent"}`,
              background: "transparent",
              color: pathname === tab.href ? "var(--text)" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            {tab.label}
          </Link>
        ))}
        <div className="header-user" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
            {displayName}
          </span>
          <button
            onClick={() => signOut()}
            style={{ padding: "5px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
          >
            Sign out
          </button>
        </div>
      </div>
      {children}
    </BudgetDataContext.Provider>
  );
}
