import { describe, expect, it } from "vitest";
import {
  guessColumnMapping,
  mapCsvRowsToExpenses,
  parseCsv,
  parseCsvAmount,
  parseCsvDate,
} from "./csv";
import { Category } from "./types";

const sampleCategories: Category[] = [
  {
    id: "cat-groc",
    user_id: "u1",
    name: "Groceries",
    budget_per_period: 125,
    is_fixed: false,
    color: "#16A34A",
    sort_order: 1,
    note: null,
    archived: false,
  },
  {
    id: "cat-dine",
    user_id: "u1",
    name: "Dining Out",
    budget_per_period: 200,
    is_fixed: false,
    color: "#DC2626",
    sort_order: 2,
    note: null,
    archived: false,
  },
];

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes, CRLF, BOM, and skips blank lines", () => {
    const csv = '\uFEFFDate,Description,Amount,Category\r\n2026-07-02,"Trader Joe""s, Market","$45.20",Groceries\r\n\r\n07/03/2026,Coffee,5.50,\r\n';
    expect(parseCsv(csv)).toEqual([
      ["Date", "Description", "Amount", "Category"],
      ["2026-07-02", 'Trader Joe"s, Market', "$45.20", "Groceries"],
      ["07/03/2026", "Coffee", "5.50", ""],
    ]);
  });
});

describe("guessColumnMapping", () => {
  it("detects standard bank/export headers", () => {
    expect(guessColumnMapping(["Transaction Date", "Merchant", "Category", "Amount"])).toEqual({
      dateIndex: 0,
      descriptionIndex: 1,
      categoryIndex: 2,
      amountIndex: 3,
    });
  });

  it("handles CSVs without a category column", () => {
    expect(guessColumnMapping(["Date", "Description", "Debit"])).toEqual({
      dateIndex: 0,
      descriptionIndex: 1,
      categoryIndex: -1,
      amountIndex: 2,
    });
  });
});

describe("parseCsvDate", () => {
  it("parses ISO and US date formats cleanly", () => {
    expect(parseCsvDate("2026-07-04")).toBe("2026-07-04");
    expect(parseCsvDate("2026-07-04T15:30:00Z")).toBe("2026-07-04");
    expect(parseCsvDate("7/4/2026")).toBe("2026-07-04");
    expect(parseCsvDate("07/04/26")).toBe("2026-07-04");
    expect(parseCsvDate("07-04-2026")).toBe("2026-07-04");
    expect(parseCsvDate("2026-02-30")).toBeNull();
    expect(parseCsvDate("not-a-date")).toBeNull();
  });
});

describe("parseCsvAmount", () => {
  it("parses currency, commas, negatives, and accounting parens", () => {
    expect(parseCsvAmount("$45.20")).toBe(45.2);
    expect(parseCsvAmount("1,234.56")).toBe(1234.56);
    expect(parseCsvAmount("-$18.99")).toBe(-18.99);
    expect(parseCsvAmount("($25.00)")).toBe(-25);
    expect(parseCsvAmount("abc")).toBeNull();
  });
});

describe("mapCsvRowsToExpenses", () => {
  it("maps valid rows, falls back to default category, supports sign inversion, and flags invalid rows", () => {
    const mapped = mapCsvRowsToExpenses({
      rows: [
        ["2026-07-02", "Trader Joe's", "-45.20", "groceries"],
        ["07/03/2026", "El Rey", "-18.50", "Unknown Cat"],
        ["bad-date", "Oops", "-10.00", "Groceries"],
        ["2026-07-04", "Zero", "0.00", "Groceries"],
      ],
      mapping: { dateIndex: 0, descriptionIndex: 1, amountIndex: 2, categoryIndex: 3 },
      categories: sampleCategories,
      defaultCategoryId: "cat-dine",
      fallbackDate: "2026-07-01",
      invertSign: true,
    });

    expect(mapped[0]).toMatchObject({
      valid: true,
      expense_date: "2026-07-02",
      description: "Trader Joe's",
      amount: 45.2,
      category_id: "cat-groc",
    });
    expect(mapped[1]).toMatchObject({
      valid: true,
      expense_date: "2026-07-03",
      description: "El Rey",
      amount: 18.5,
      category_id: "cat-dine",
    });
    expect(mapped[2].valid).toBe(false);
    expect(mapped[3].valid).toBe(false);
  });
});
