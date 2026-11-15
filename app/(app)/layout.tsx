"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
  { href: "/", label: "This Period", short: "Period", icon: "◉" },
  { href: "/overview", label: "Overview", short: "Overview", icon: "▤" },
  { href: "/investments", label: "Investments", short: "Invest", icon: "↗" },
  { href: "/admin", label: "Admin", short: "Admin", icon: "⚙" },
];

function tabActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

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
  // Bumps on every auth change / load kickoff so a slower in-flight fetch
  // for a previous user can't overwrite state after a sign-out or switch.
  const loadGen = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setAuthReady(true);
    });
    return onAuthChange(setSession);
  }, []);

  const loadAll = useCallback(async () => {
    const active = sessionRef.current;
    if (!active) return;
    const gen = ++loadGen.current;
    const userId = active.user.id;
    setError(null);
    let pageData = await loadPageData();
    if (gen !== loadGen.current || sessionRef.current?.user.id !== userId) return;

    // Incomplete onboarding: missing config, categories, or first period.
    // setupNewUser is idempotent and fills only what's missing.
    if (
      !pageData.error &&
      (!pageData.paycheckConfig || pageData.categories.length === 0 || pageData.payPeriods.length === 0)
    ) {
      const meta = active.user.user_metadata ?? {};
      const num = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null);
      const setupError = await setupNewUser({
        pay_type: meta.pay_type === "hourly" ? "hourly" : "salary",
        annual_salary: num(meta.annual_salary),
        hourly_rate: num(meta.hourly_rate),
        night_diff_value: num(meta.night_diff_value),
        default_day_hours: num(meta.default_day_hours),
        default_night_hours: num(meta.default_night_hours),
      });
      if (gen !== loadGen.current || sessionRef.current?.user.id !== userId) return;
      if (setupError) {
        setError(setupError);
        setLoading(false);
        return;
      }
      pageData = await loadPageData();
      if (gen !== loadGen.current || sessionRef.current?.user.id !== userId) return;
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
  }, []);

  useEffect(() => {
    // Invalidate any in-flight load from the previous session immediately.
    loadGen.current += 1;
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
      setError(null);
      setLoading(false);
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
      <div className="app-shell">
        <div
          className="desktop-nav"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", background: "var(--bg-page)", borderBottom: "1px solid var(--border)" }}
        >
          {TABS.map((tab) => {
            const active = tabActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="header-tab"
                style={{
                  display: "inline-block",
                  border: "none",
                  borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  background: "transparent",
                  color: active ? "var(--text)" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
          <div className="header-user" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
              {displayName}
            </span>
            <button
              onClick={() => signOut()}
              style={{ padding: "8px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, minHeight: 36 }}
            >
              Sign out
            </button>
          </div>
        </div>

        {children}

        <nav className="bottom-nav" aria-label="Main">
          {TABS.map((tab) => {
            const active = tabActive(pathname, tab.href);
            return (
              <Link key={tab.href} href={tab.href} data-active={active ? "true" : "false"}>
                <span className="nav-icon" aria-hidden>
                  {tab.icon}
                </span>
                {tab.short}
              </Link>
            );
          })}
        </nav>
      </div>
    </BudgetDataContext.Provider>
  );
}
