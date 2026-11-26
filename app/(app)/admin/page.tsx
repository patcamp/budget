"use client";

import AdminPanel from "@/components/ui/AdminPanel";
import { useBudgetData } from "../layout";

export default function AdminPage() {
  const { paycheckConfig, payPeriods, categories, expenses, recurringExpenses, profile, onRefresh } = useBudgetData();
  return (
    <AdminPanel
      config={paycheckConfig}
      payPeriods={payPeriods}
      categories={categories}
      expenses={expenses}
      recurringExpenses={recurringExpenses}
      profile={profile}
      onRefresh={onRefresh}
    />
  );
}
