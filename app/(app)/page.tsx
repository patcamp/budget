"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Dashboard from "@/components/ui/Dashboard";
import { useBudgetData } from "./layout";

export default function ThisPeriodPage() {
  const { payPeriods, categories, expenses, profile, paycheckConfig, onRefresh } = useBudgetData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const sortedPeriods = useMemo(
    () => [...payPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [payPeriods]
  );

  const periodParam = searchParams.get("period");
  const selectedPeriodId =
    periodParam && sortedPeriods.some((p) => p.id === periodParam)
      ? periodParam
      : sortedPeriods.length
        ? sortedPeriods[sortedPeriods.length - 1].id
        : null;

  const categoryParam = searchParams.get("category");
  const statementFilter =
    categoryParam && categoryParam !== "all" && categories.some((c) => c.id === categoryParam)
      ? categoryParam
      : "all";

  // Canonicalize stale/invalid query params so bookmarks match what the UI shows.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let dirty = false;
    if (periodParam && selectedPeriodId && periodParam !== selectedPeriodId) {
      params.set("period", selectedPeriodId);
      dirty = true;
    }
    if (categoryParam && categoryParam !== "all" && statementFilter === "all") {
      params.delete("category");
      dirty = true;
    }
    if (!dirty) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [periodParam, selectedPeriodId, categoryParam, statementFilter, searchParams, router, pathname]);

  function updateParams(next: { period?: string | null; category?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if ("period" in next) {
      if (next.period) params.set("period", next.period);
      else params.delete("period");
    }
    if ("category" in next) {
      if (next.category && next.category !== "all") params.set("category", next.category);
      else params.delete("category");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Dashboard
      payPeriods={payPeriods}
      categories={categories}
      expenses={expenses}
      profile={profile}
      paycheckConfig={paycheckConfig}
      onRefresh={onRefresh}
      selectedPeriodId={selectedPeriodId}
      onSelectedPeriodIdChange={(id) => updateParams({ period: id })}
      statementFilter={statementFilter}
      onStatementFilterChange={(filter) => updateParams({ category: filter })}
    />
  );
}
