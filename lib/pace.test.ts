import { describe, expect, it } from "vitest";
import { computePeriodPace, matchesExpenseSearch } from "./pace";

describe("computePeriodPace", () => {
  it("computes remaining days inclusive of today on day 1 of a 14-day period", () => {
    const pace = computePeriodPace({
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      surplus: 1400,
      totalSpent: 0,
      today: "2026-07-01",
    });
    expect(pace.status).toBe("active");
    expect(pace.totalDays).toBe(14);
    expect(pace.daysElapsed).toBe(1);
    expect(pace.daysRemaining).toBe(14);
    expect(pace.dailySafeToSpend).toBeCloseTo(100);
    expect(pace.dailySpentAvg).toBe(0);
  });

  it("computes mid-period daily safe to spend and daily spent avg", () => {
    const pace = computePeriodPace({
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      surplus: 640,
      totalSpent: 760,
      today: "2026-07-07", // Day 7 of 14 -> 8 days left (7..14 inclusive)
    });
    expect(pace.status).toBe("active");
    expect(pace.daysElapsed).toBe(7);
    expect(pace.daysRemaining).toBe(8);
    expect(pace.dailySafeToSpend).toBeCloseTo(80);
    expect(pace.dailySpentAvg).toBeCloseTo(760 / 7);
  });

  it("treats the final day as 1 day remaining (never divides by zero)", () => {
    const pace = computePeriodPace({
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      surplus: 125.5,
      totalSpent: 1274.5,
      today: "2026-07-14",
    });
    expect(pace.status).toBe("active");
    expect(pace.daysElapsed).toBe(14);
    expect(pace.daysRemaining).toBe(1);
    expect(pace.dailySafeToSpend).toBeCloseTo(125.5);
  });

  it("clamps dailySafeToSpend to 0 when over budget", () => {
    const pace = computePeriodPace({
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      surplus: -200,
      totalSpent: 1600,
      today: "2026-07-10",
    });
    expect(pace.status).toBe("active");
    expect(pace.dailySafeToSpend).toBe(0);
  });

  it("handles upcoming periods", () => {
    const pace = computePeriodPace({
      startDate: "2026-07-15",
      endDate: "2026-07-28",
      surplus: 1400,
      totalSpent: 0,
      today: "2026-07-12",
    });
    expect(pace.status).toBe("upcoming");
    expect(pace.daysUntilStart).toBe(3);
    expect(pace.daysRemaining).toBe(14);
    expect(pace.dailySafeToSpend).toBeCloseTo(100);
  });

  it("handles ended periods", () => {
    const pace = computePeriodPace({
      startDate: "2026-06-01",
      endDate: "2026-06-14",
      surplus: 300,
      totalSpent: 1120,
      today: "2026-06-20",
    });
    expect(pace.status).toBe("ended");
    expect(pace.daysRemaining).toBe(0);
    expect(pace.dailySafeToSpend).toBe(0);
    expect(pace.dailySpentAvg).toBeCloseTo(80);
  });
});

describe("matchesExpenseSearch", () => {
  const expense = { description: "Trader Joe's run", amount: 64.5 };

  it("matches empty query", () => {
    expect(matchesExpenseSearch(expense, "Groceries", "   ")).toBe(true);
  });

  it("matches description case-insensitively", () => {
    expect(matchesExpenseSearch(expense, "Groceries", "trader")).toBe(true);
    expect(matchesExpenseSearch(expense, "Groceries", "walmart")).toBe(false);
  });

  it("matches category name", () => {
    expect(matchesExpenseSearch(expense, "Groceries", "groc")).toBe(true);
  });

  it("matches formatted and raw amounts with or without $", () => {
    expect(matchesExpenseSearch(expense, "Groceries", "64.50")).toBe(true);
    expect(matchesExpenseSearch(expense, "Groceries", "$64.5")).toBe(true);
    expect(matchesExpenseSearch(expense, "Groceries", "64")).toBe(true);
    expect(matchesExpenseSearch(expense, "Groceries", "99")).toBe(false);
  });
});
