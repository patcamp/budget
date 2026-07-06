import { describe, expect, it } from "vitest";
import { Account } from "./types";
import { computeBreakdown, hourlyGross, nightRate, toAllocations } from "./paycheck";

const noDeductions = {
  health_insurance_amount: 0,
  hsa_amount: 0,
  federal_tax_pct: 0,
  state_tax_pct: 0,
  fica_pct: 0,
};

const acct = (name: string, type: Account["type"], pct: number): Account => ({
  id: name,
  name,
  type,
  pct,
});

describe("nightRate", () => {
  it("adds a flat $/hr differential to the base rate", () => {
    expect(nightRate(40, "flat", 5)).toBe(45);
  });

  it("adds a percentage differential of the base rate", () => {
    expect(nightRate(40, "pct", 10)).toBe(44);
  });

  it("returns the base rate when the differential is zero", () => {
    expect(nightRate(40, "flat", 0)).toBe(40);
    expect(nightRate(40, "pct", 0)).toBe(40);
  });
});

describe("hourlyGross", () => {
  it("pays day hours at base rate and night hours at the night rate", () => {
    // 60h day @ $40 + 20h night @ $45 = 2400 + 900
    expect(hourlyGross(40, "flat", 5, 60, 20)).toBe(3300);
  });

  it("handles a % differential", () => {
    // 10h day @ $30 + 10h night @ $33 (30 + 10%)
    expect(hourlyGross(30, "pct", 10, 10, 10)).toBe(630);
  });

  it("is zero when no hours are worked", () => {
    expect(hourlyGross(40, "flat", 5, 0, 0)).toBe(0);
  });
});

describe("computeBreakdown", () => {
  it("passes gross straight through to net with no deductions, taxes, or accounts", () => {
    const b = computeBreakdown(4000, noDeductions, []);
    expect(b.preTaxTotal).toBe(0);
    expect(b.taxable).toBe(4000);
    expect(b.taxes).toBe(0);
    expect(b.net).toBe(4000);
  });

  it("subtracts flat pre-tax deductions from taxable income before taxes", () => {
    const b = computeBreakdown(4000, { ...noDeductions, health_insurance_amount: 150, hsa_amount: 50, federal_tax_pct: 10 }, []);
    expect(b.preTaxTotal).toBe(200);
    expect(b.taxable).toBe(3800);
    expect(b.taxes).toBeCloseTo(380);
    expect(b.net).toBeCloseTo(4000 - 200 - 380);
  });

  it("sums federal + state + FICA into one effective tax rate on taxable income", () => {
    const b = computeBreakdown(1000, { ...noDeductions, federal_tax_pct: 10, state_tax_pct: 5, fica_pct: 7.65 }, []);
    expect(b.taxRate).toBeCloseTo(0.2265);
    expect(b.taxes).toBeCloseTo(226.5);
  });

  it("takes pre_tax accounts as % of gross and reduces taxable income", () => {
    // 10% traditional 401k on $2000 gross = $200 pre-tax
    const b = computeBreakdown(2000, { ...noDeductions, federal_tax_pct: 10 }, [acct("401k", "pre_tax", 10)]);
    expect(b.acctPreTax).toBe(200);
    expect(b.taxable).toBe(1800);
    expect(b.net).toBeCloseTo(2000 - 200 - 180);
  });

  it("takes post_tax accounts as % of gross without reducing taxable income", () => {
    const b = computeBreakdown(2000, { ...noDeductions, federal_tax_pct: 10 }, [acct("Roth", "post_tax", 10)]);
    expect(b.taxable).toBe(2000);
    expect(b.postTaxTotal).toBe(200);
    expect(b.net).toBeCloseTo(2000 - 200 - 200);
  });

  it("splits net across spending/other accounts as % of net, not gross", () => {
    const accounts = [acct("Checking", "spending", 60), acct("Savings", "other", 40)];
    const b = computeBreakdown(1000, { ...noDeductions, federal_tax_pct: 20 }, accounts);
    expect(b.net).toBeCloseTo(800);
    expect(b.spending).toBeCloseTo(480); // 60% of net
    expect(b.netPct).toBe(100);
    const savings = b.withAmounts.find((a) => a.name === "Savings")!;
    expect(savings.amount).toBeCloseTo(320); // 40% of net
  });

  it("prices pre/post-tax account amounts off gross and the rest off net in withAmounts", () => {
    const accounts = [acct("401k", "pre_tax", 10), acct("Checking", "spending", 100)];
    const b = computeBreakdown(1000, noDeductions, accounts);
    expect(b.withAmounts.find((a) => a.name === "401k")!.amount).toBeCloseTo(100); // 10% of gross
    expect(b.withAmounts.find((a) => a.name === "Checking")!.amount).toBeCloseTo(900); // 100% of net
  });
});

describe("toAllocations", () => {
  it("maps accounts to the {name, type, amount} JSONB shape with amounts rounded to cents", () => {
    const accounts = [acct("Checking", "spending", 33.33)];
    const b = computeBreakdown(1000, noDeductions, accounts);
    const allocs = toAllocations(b);
    expect(allocs).toEqual([{ name: "Checking", type: "spending", amount: 333.3 }]);
  });

  it("rounds to exactly two decimal places", () => {
    const accounts = [acct("Checking", "spending", 33.335)];
    const b = computeBreakdown(1000, noDeductions, accounts);
    expect(toAllocations(b)[0].amount).toBeCloseTo(333.35, 2);
    expect(`${toAllocations(b)[0].amount}`).not.toMatch(/\.\d{3,}/);
  });
});
