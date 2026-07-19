"use client";

import { useMemo } from "react";
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
      ? periodsParam.split(",").filter((id) => sortedPeriods.some((p) => p.id === id))
      : sortedPeriods.map((p) => p.id);

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
