"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Overview from "@/components/ui/Overview";
import { useBudgetData } from "../layout";

export default function OverviewPage() {
  const { payPeriods, categories, expenses } = useBudgetData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const sortedPeriods = useMemo(
    () => [...payPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [payPeriods]
  );

  const periodsParam = searchParams.get("periods");
  const selectedIds =
    periodsParam !== null
      ? periodsParam.split(",").filter((id) => id && sortedPeriods.some((p) => p.id === id))
      : sortedPeriods.map((p) => p.id);

  // Drop stale period ids from the URL after deletes / data refresh.
  useEffect(() => {
    if (periodsParam === null) return;
    const raw = periodsParam.split(",").filter(Boolean);
    const cleaned = raw.filter((id) => sortedPeriods.some((p) => p.id === id));
    if (cleaned.length === raw.length) return;
    const params = new URLSearchParams(searchParams.toString());
    const allSelected = cleaned.length === sortedPeriods.length && sortedPeriods.length > 0;
    if (allSelected) params.delete("periods");
    else params.set("periods", cleaned.join(","));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [periodsParam, sortedPeriods, searchParams, router, pathname]);

  function handleSelectedIdsChange(ids: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    const allSelected = ids.length === sortedPeriods.length && sortedPeriods.length > 0;
    if (allSelected) params.delete("periods");
    else params.set("periods", ids.join(","));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Overview
      payPeriods={payPeriods}
      categories={categories}
      expenses={expenses}
      selectedIds={selectedIds}
      onSelectedIdsChange={handleSelectedIdsChange}
    />
  );
}
