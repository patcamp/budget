import { Account } from "./types";

// Pure paycheck math shared by AdminPanel (config preview/save) and
// the This Period hours editor. No Supabase imports.

export type NightDiffType = "flat" | "pct";

// Effective hourly rate for night hours: base + differential.
export function nightRate(rate: number, diffType: NightDiffType, diffValue: number): number {
  const diff = diffType === "pct" ? (rate * diffValue) / 100 : diffValue;
  return rate + diff;
}

export function hourlyGross(
  rate: number,
  diffType: NightDiffType,
  diffValue: number,
  dayHours: number,
  nightHours: number
): number {
  return dayHours * rate + nightHours * nightRate(rate, diffType, diffValue);
}

export interface BreakdownInputs {
  health_insurance_amount: number;
  hsa_amount: number;
  federal_tax_pct: number;
  state_tax_pct: number;
  fica_pct: number;
}

// Order matters: pre-tax deductions reduce taxable income first, then taxes are applied,
// then post-tax deductions (e.g. Roth), leaving the net available for spending/savings split.
export function computeBreakdown(gross: number, f: BreakdownInputs, accounts: Account[]) {
  const fixedPreTax = f.health_insurance_amount + f.hsa_amount;
  const acctPreTax = accounts.filter((a) => a.type === "pre_tax").reduce((s, a) => s + (gross * a.pct) / 100, 0);
  const preTaxTotal = fixedPreTax + acctPreTax;
  const taxable = gross - preTaxTotal;
  const taxRate = (f.federal_tax_pct + f.state_tax_pct + f.fica_pct) / 100;
  const taxes = taxable * taxRate;
  const postTaxTotal = accounts.filter((a) => a.type === "post_tax").reduce((s, a) => s + (gross * a.pct) / 100, 0);
  const net = gross - preTaxTotal - taxes - postTaxTotal;
  const netPct = accounts.filter((a) => a.type === "spending" || a.type === "other").reduce((s, a) => s + a.pct, 0);
  const spending = accounts.filter((a) => a.type === "spending").reduce((s, a) => s + (net * a.pct) / 100, 0);
  const withAmounts = accounts.map((a) => ({
    ...a,
    amount: a.type === "pre_tax" || a.type === "post_tax" ? (gross * a.pct) / 100 : (net * a.pct) / 100,
  }));
  return { gross, fixedPreTax, acctPreTax, preTaxTotal, taxable, taxRate, taxes, postTaxTotal, net, netPct, spending, withAmounts };
}

export type Breakdown = ReturnType<typeof computeBreakdown>;

// The allocations JSONB shape stored on pay_periods.
export function toAllocations(breakdown: Breakdown): { name: string; type: string; amount: number }[] {
  return breakdown.withAmounts.map((a) => ({ name: a.name, type: a.type, amount: Number(a.amount.toFixed(2)) }));
}
