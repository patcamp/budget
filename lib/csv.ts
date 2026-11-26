import { Category } from "./types";

/**
 * Lightweight RFC-4180 CSV parser (no external dependencies).
 * Handles quoted fields, escaped quotes (""), CRLF/LF, UTF-8 BOM, and skips blank lines.
 */
export function parseCsv(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      field = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

export interface CsvColumnMapping {
  dateIndex: number; // -1 if unmapped
  descriptionIndex: number; // -1 if unmapped
  amountIndex: number; // -1 if unmapped
  categoryIndex: number; // -1 if unmapped (optional)
}

/** Auto-detect column indices from a CSV header row. */
export function guessColumnMapping(headers: string[]): CsvColumnMapping {
  const lower = headers.map((h) => h.trim().toLowerCase());

  const findMatch = (patterns: RegExp[], exclude: number[] = []) => {
    for (const pat of patterns) {
      const idx = lower.findIndex((h, i) => !exclude.includes(i) && pat.test(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateIndex = findMatch([/^date$/, /trans.*date/, /post.*date/, /date/]);
  const amountIndex = findMatch(
    [/^amount$/, /^debit$/, /amount/, /price/, /total/, /cost/, /value/],
    dateIndex >= 0 ? [dateIndex] : []
  );
  const categoryIndex = findMatch(
    [/^category$/, /category/, /^cat$/],
    [dateIndex, amountIndex].filter((i) => i >= 0)
  );
  const descriptionIndex = findMatch(
    [/^description$/, /^merchant$/, /^memo$/, /^name$/, /desc/, /payee/, /detail/, /note/],
    [dateIndex, amountIndex, categoryIndex].filter((i) => i >= 0)
  );

  return { dateIndex, descriptionIndex, amountIndex, categoryIndex };
}

/** Parse common bank/spreadsheet date strings into local YYYY-MM-DD without UTC shifting. */
export function parseCsvDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO prefix: YYYY-MM-DD or YYYY/MM/DD (optionally followed by time)
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (iso) {
    const [, yStr, mStr, dStr] = iso;
    return validateYmd(Number(yStr), Number(mStr), Number(dStr));
  }

  // US format: MM/DD/YYYY, M/D/YY, MM-DD-YYYY
  const us = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (us) {
    const [, mStr, dStr, yRaw] = us;
    const yNum = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    return validateYmd(yNum, Number(mStr), Number(dStr));
  }

  return null;
}

function validateYmd(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse currency strings like "$12.34", "1,234.56", "-$45.00", "($45.00)". */
export function parseCsvAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;

  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    s = s.slice(1).trim();
  }

  const cleaned = s.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(cleaned)) return null;

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return negative ? -num : num;
}

export interface MappedCsvExpense {
  rowNumber: number;
  expense_date: string;
  description: string | null;
  amount: number;
  category_id: string;
  categoryName: string;
  valid: boolean;
  error?: string;
}

export interface MapCsvOptions {
  rows: string[][];
  mapping: CsvColumnMapping;
  categories: Category[];
  defaultCategoryId: string;
  fallbackDate: string;
  invertSign?: boolean;
}

export function mapCsvRowsToExpenses({
  rows,
  mapping,
  categories,
  defaultCategoryId,
  fallbackDate,
  invertSign = false,
}: MapCsvOptions): MappedCsvExpense[] {
  const categoryByLower = new Map<string, Category>();
  const categoryById = new Map<string, Category>();
  for (const c of categories) {
    categoryByLower.set(c.name.trim().toLowerCase(), c);
    categoryById.set(c.id, c);
  }
  const defaultCategory = categoryById.get(defaultCategoryId) ?? categories[0];

  return rows.map((cells, index) => {
    const rawDate = mapping.dateIndex >= 0 ? (cells[mapping.dateIndex] ?? "") : "";
    const rawDesc = mapping.descriptionIndex >= 0 ? (cells[mapping.descriptionIndex] ?? "") : "";
    const rawAmt = mapping.amountIndex >= 0 ? (cells[mapping.amountIndex] ?? "") : "";
    const rawCat = mapping.categoryIndex >= 0 ? (cells[mapping.categoryIndex] ?? "") : "";

    const parsedDate = mapping.dateIndex >= 0 ? parseCsvDate(rawDate) : fallbackDate;
    const parsedAmt = parseCsvAmount(rawAmt);
    const amount = parsedAmt != null ? Math.round((invertSign ? -parsedAmt : parsedAmt) * 100) / 100 : null;

    const matchedCategory =
      (rawCat ? categoryByLower.get(rawCat.trim().toLowerCase()) : undefined) ?? defaultCategory;

    if (!matchedCategory) {
      return {
        rowNumber: index + 1,
        expense_date: parsedDate ?? fallbackDate,
        description: rawDesc || null,
        amount: amount ?? 0,
        category_id: "",
        categoryName: "None",
        valid: false,
        error: "No category available",
      };
    }

    if (mapping.dateIndex >= 0 && !parsedDate) {
      return {
        rowNumber: index + 1,
        expense_date: rawDate || "—",
        description: rawDesc || null,
        amount: amount ?? 0,
        category_id: matchedCategory.id,
        categoryName: matchedCategory.name,
        valid: false,
        error: `Invalid date "${rawDate}"`,
      };
    }

    if (amount === null || amount === 0) {
      return {
        rowNumber: index + 1,
        expense_date: parsedDate ?? fallbackDate,
        description: rawDesc || null,
        amount: 0,
        category_id: matchedCategory.id,
        categoryName: matchedCategory.name,
        valid: false,
        error: rawAmt ? `Invalid or zero amount "${rawAmt}"` : "Missing amount",
      };
    }

    return {
      rowNumber: index + 1,
      expense_date: parsedDate ?? fallbackDate,
      description: rawDesc.trim() || null,
      amount,
      category_id: matchedCategory.id,
      categoryName: matchedCategory.name,
      valid: true,
    };
  });
}
