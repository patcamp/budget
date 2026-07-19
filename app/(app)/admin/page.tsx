"use client";

import AdminPanel from "@/components/ui/AdminPanel";
import { useBudgetData } from "../layout";

export default function AdminPage() {
  const { paycheckConfig, payPeriods, categories, expenses, profile, onRefresh } = useBudgetData();
  return (
    <AdminPanel
      config={paycheckConfig}
      payPeriods={payPeriods}
      categories={categories}
      expenses={expenses}
      profile={profile}
      onRefresh={onRefresh}
    />
  );
}
