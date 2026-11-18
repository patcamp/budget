"use client";

import InvestmentPanel from "@/components/ui/InvestmentPanel";
import { useBudgetData } from "../layout";

export default function InvestmentsPage() {
  const { investments, investmentPurchases, payPeriods, paycheckConfig, onRefresh } = useBudgetData();
  return (
    <InvestmentPanel
      investments={investments}
      purchases={investmentPurchases}
      payPeriods={payPeriods}
      paycheckConfig={paycheckConfig}
      onRefresh={onRefresh}
    />
  );
}
