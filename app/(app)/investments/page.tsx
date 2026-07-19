"use client";

import InvestmentPanel from "@/components/ui/InvestmentPanel";
import { useBudgetData } from "../layout";

export default function InvestmentsPage() {
  const { investments, onRefresh } = useBudgetData();
  return <InvestmentPanel investments={investments} onRefresh={onRefresh} />;
}
