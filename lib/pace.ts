import { daysBetweenLocal, toLocalDateString } from "./dates";

export type PeriodPaceStatus = "active" | "upcoming" | "ended";

export interface PeriodPace {
  status: PeriodPaceStatus;
  totalDays: number;
  /** 1-based current day number when active (0 when upcoming, totalDays when ended). */
  daysElapsed: number;
  /** Days remaining inclusive of today when active (totalDays when upcoming, 0 when ended). */
  daysRemaining: number;
  /** Days until the period starts (only > 0 when upcoming). */
  daysUntilStart: number;
  /** Safe daily spend for remaining days (clamped to >= 0; 0 when ended or over budget). */
  dailySafeToSpend: number;
  /** Average spent per elapsed day so far (or across the full period when ended). */
  dailySpentAvg: number;
}

export interface ComputePeriodPaceInput {
  startDate: string;
  endDate: string;
  surplus: number;
  totalSpent: number;
  today?: string;
}

export function computePeriodPace({
  startDate,
  endDate,
  surplus,
  totalSpent,
  today = toLocalDateString(),
}: ComputePeriodPaceInput): PeriodPace {
  const totalDays = Math.max(1, daysBetweenLocal(startDate, endDate) + 1);
  const safeSurplus = Math.max(0, surplus);

  if (today < startDate) {
    return {
      status: "upcoming",
      totalDays,
      daysElapsed: 0,
      daysRemaining: totalDays,
      daysUntilStart: Math.max(1, daysBetweenLocal(today, startDate)),
      dailySafeToSpend: safeSurplus / totalDays,
      dailySpentAvg: 0,
    };
  }

  if (today > endDate) {
    return {
      status: "ended",
      totalDays,
      daysElapsed: totalDays,
      daysRemaining: 0,
      daysUntilStart: 0,
      dailySafeToSpend: 0,
      dailySpentAvg: totalSpent / totalDays,
    };
  }

  const daysElapsed = Math.max(1, daysBetweenLocal(startDate, today) + 1);
  const daysRemaining = Math.max(1, daysBetweenLocal(today, endDate) + 1);

  return {
    status: "active",
    totalDays,
    daysElapsed,
    daysRemaining,
    daysUntilStart: 0,
    dailySafeToSpend: safeSurplus / daysRemaining,
    dailySpentAvg: totalSpent / daysElapsed,
  };
}

/** Matches an expense against a free-text query (description, category name, or amount). */
export function matchesExpenseSearch(
  expense: { description: string | null; amount: number },
  categoryName: string | undefined,
  rawQuery: string
): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const desc = (expense.description ?? "").toLowerCase();
  if (desc.includes(query)) return true;

  const cat = (categoryName ?? "").toLowerCase();
  if (cat && cat.includes(query)) return true;

  // Amount matching: allow searching "45", "45.5", "45.50", "$45.50", "1,200"
  const num = Number(expense.amount);
  const normalizedQuery = query.replace(/[$,\s]/g, "");
  if (normalizedQuery) {
    const fixed = num.toFixed(2);
    const plain = String(num);
    if (fixed.includes(normalizedQuery) || plain.includes(normalizedQuery)) {
      return true;
    }
  }

  return false;
}
