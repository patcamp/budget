"use client";

import { useMemo, useState } from "react";
import { addExpensesBulk } from "@/components/api/expenses";
import {
  CsvColumnMapping,
  guessColumnMapping,
  mapCsvRowsToExpenses,
  parseCsv,
  parseCsvAmount,
} from "@/lib/csv";
import { Category } from "@/lib/types";
import { useToast } from "./Toast";

interface Props {
  payPeriodId: string;
  periodLabel: string;
  fallbackDate: string;
  categories: Category[];
  onImported: () => Promise<void>;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-page)",
  border: "1px solid var(--border)",
  borderRadius: 7,
  color: "var(--text-body)",
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  display: "block",
  marginBottom: 4,
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CsvImportModal({
  payPeriodId,
  periodLabel,
  fallbackDate,
  categories,
  onImported,
  onClose,
}: Props) {
  const toast = useToast();
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    dateIndex: 0,
    descriptionIndex: 1,
    amountIndex: 2,
    categoryIndex: -1,
  });
  const [defaultCategoryId, setDefaultCategoryId] = useState(categories[0]?.id ?? "");
  const [invertSign, setInvertSign] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedRows = useMemo(() => parseCsv(rawText), [rawText]);

  const columnCount = useMemo(
    () => parsedRows.reduce((max, r) => Math.max(max, r.length), 0),
    [parsedRows]
  );

  const headers = useMemo(() => {
    if (parsedRows.length === 0) return [];
    if (hasHeader) {
      return Array.from({ length: columnCount }, (_, i) => parsedRows[0][i] || `Column ${i + 1}`);
    }
    return Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
  }, [parsedRows, hasHeader, columnCount]);

  const dataRows = useMemo(() => {
    if (parsedRows.length === 0) return [];
    return hasHeader ? parsedRows.slice(1) : parsedRows;
  }, [parsedRows, hasHeader]);

  function applyRawCsv(text: string, useHeader: boolean) {
    setRawText(text);
    setError(null);
    const rows = parseCsv(text);
    if (rows.length === 0) return;

    const firstRow = rows[0];
    const nextMapping: CsvColumnMapping = useHeader
      ? guessColumnMapping(firstRow)
      : {
          dateIndex: firstRow.length > 0 ? 0 : -1,
          descriptionIndex: firstRow.length > 1 ? 1 : -1,
          amountIndex: firstRow.length > 2 ? 2 : -1,
          categoryIndex: firstRow.length > 3 ? 3 : -1,
        };
    setMapping(nextMapping);

    // Auto-detect bank CSVs where charges are negative numbers.
    const body = useHeader ? rows.slice(1) : rows;
    if (nextMapping.amountIndex >= 0 && body.length > 0) {
      let neg = 0;
      let pos = 0;
      for (const r of body.slice(0, 50)) {
        const amt = parseCsvAmount(r[nextMapping.amountIndex] ?? "");
        if (amt != null && amt < 0) neg += 1;
        else if (amt != null && amt > 0) pos += 1;
      }
      setInvertSign(neg > pos);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      applyRawCsv(typeof reader.result === "string" ? reader.result : "", hasHeader);
    };
    reader.onerror = () => {
      setError("Could not read that file.");
    };
    reader.readAsText(file);
  }

  const mappedRows = useMemo(
    () =>
      mapCsvRowsToExpenses({
        rows: dataRows,
        mapping,
        categories,
        defaultCategoryId,
        fallbackDate,
        invertSign,
      }),
    [dataRows, mapping, categories, defaultCategoryId, fallbackDate, invertSign]
  );

  const validRows = useMemo(() => mappedRows.filter((r) => r.valid), [mappedRows]);
  const skippedCount = mappedRows.length - validRows.length;
  const totalAmount = useMemo(
    () => validRows.reduce((sum, r) => sum + Number(r.amount), 0),
    [validRows]
  );

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setError(null);
    const err = await addExpensesBulk(
      validRows.map((r) => ({
        pay_period_id: payPeriodId,
        category_id: r.category_id,
        amount: r.amount,
        description: r.description,
        expense_date: r.expense_date,
      }))
    );
    setImporting(false);
    if (err) {
      setError(err);
      toast.error(`CSV import failed: ${err}`);
      return;
    }
    toast.success(`Imported ${validRows.length} expense${validRows.length === 1 ? "" : "s"} (${fmtMoney(totalAmount)}).`);
    await onImported();
    onClose();
  }

  const previewRows = mappedRows.slice(0, 10);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import expenses from CSV"
      className="csv-modal-backdrop"
      onClick={onClose}
    >
      <div className="csv-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-page)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Import CSV</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              Target period: {periodLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close CSV import"
            className="tap-target"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-muted)",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              width: 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          {/* File upload + paste */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>1. Choose a CSV file or paste rows</label>
              <label
                className="tap-target"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "7px 12px",
                  borderRadius: 7,
                  border: "1px dashed var(--border-strong)",
                  color: "var(--text-body)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {fileName ? `File: ${fileName}` : "Choose .csv file"}
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => {
                setFileName(null);
                applyRawCsv(e.target.value, hasHeader);
              }}
              placeholder={"Date,Description,Amount,Category\n2026-07-02,Trader Joe's,64.50,Groceries\n2026-07-03,Coffee,5.75,Dining Out"}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", cursor: "pointer", minHeight: 32 }}>
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setHasHeader(next);
                    if (rawText) applyRawCsv(rawText, next);
                  }}
                />
                First row is column headers
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", cursor: "pointer", minHeight: 32 }}>
                <input
                  type="checkbox"
                  checked={invertSign}
                  onChange={(e) => setInvertSign(e.target.checked)}
                />
                Flip signs (negative = expense)
              </label>
            </div>
          </div>

          {/* Column mapping */}
          {columnCount > 0 && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>2. Map columns &amp; default category</div>
              <div className="csv-mapping-grid">
                <div>
                  <label style={labelStyle}>Date column</label>
                  <select
                    value={mapping.dateIndex}
                    onChange={(e) => setMapping((m) => ({ ...m, dateIndex: Number(e.target.value) }))}
                    style={inputStyle}
                  >
                    <option value={-1}>None (use {fallbackDate})</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Description column</label>
                  <select
                    value={mapping.descriptionIndex}
                    onChange={(e) => setMapping((m) => ({ ...m, descriptionIndex: Number(e.target.value) }))}
                    style={inputStyle}
                  >
                    <option value={-1}>None</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Amount column</label>
                  <select
                    value={mapping.amountIndex}
                    onChange={(e) => setMapping((m) => ({ ...m, amountIndex: Number(e.target.value) }))}
                    style={inputStyle}
                  >
                    <option value={-1}>Select column…</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Category column (optional)</label>
                  <select
                    value={mapping.categoryIndex}
                    onChange={(e) => setMapping((m) => ({ ...m, categoryIndex: Number(e.target.value) }))}
                    style={inputStyle}
                  >
                    <option value={-1}>None (use default below)</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Default category (when blank or unmatched)</label>
                <select
                  value={defaultCategoryId}
                  onChange={(e) => setDefaultCategoryId(e.target.value)}
                  style={inputStyle}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Preview */}
          {mappedRows.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>
                  3. Preview ({validRows.length} ready · {fmtMoney(totalAmount)})
                </span>
                {skippedCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--warning-text)" }}>
                    {skippedCount} row{skippedCount === 1 ? "" : "s"} will be skipped
                  </span>
                )}
              </div>

              <div className="scroll-x" style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-page)" }}>
                <div className="scroll-x-content" style={{ minWidth: 460 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "92px 1fr 120px 84px",
                      gap: 8,
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-faint)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    <span>Date</span>
                    <span>Description</span>
                    <span>Category</span>
                    <span style={{ textAlign: "right" }}>Amount</span>
                  </div>
                  {previewRows.map((r) => (
                    <div
                      key={r.rowNumber}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "92px 1fr 120px 84px",
                        gap: 8,
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--border-soft)",
                        fontSize: 12,
                        opacity: r.valid ? 1 : 0.65,
                        background: r.valid ? "transparent" : "var(--danger-bg)",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{r.expense_date}</span>
                      <span style={{ color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.description || "—"}
                        {r.error && (
                          <span style={{ display: "block", fontSize: 10, color: "var(--danger-text)" }}>{r.error}</span>
                        )}
                      </span>
                      <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.categoryName}
                      </span>
                      <span style={{ textAlign: "right", fontWeight: 600, color: r.valid ? "var(--text)" : "var(--danger-text)", fontVariantNumeric: "tabular-nums" }}>
                        {r.valid ? fmtMoney(r.amount) : "Skip"}
                      </span>
                    </div>
                  ))}
                  {mappedRows.length > previewRows.length && (
                    <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}>
                      …and {mappedRows.length - previewRows.length} more row{mappedRows.length - previewRows.length === 1 ? "" : "s"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--danger-bg)", border: "1px solid var(--danger-border)", fontSize: 12, color: "var(--danger-text)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "12px 18px calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-panel)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="tap-target"
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || validRows.length === 0 || categories.length === 0}
            className="tap-target"
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid var(--accent)",
              background: "var(--accent-strong)",
              color: "var(--accent-text)",
              fontSize: 13,
              fontWeight: 700,
              cursor: importing ? "wait" : validRows.length === 0 ? "not-allowed" : "pointer",
              opacity: importing || validRows.length === 0 ? 0.5 : 1,
              minHeight: 44,
            }}
          >
            {importing
              ? "Importing…"
              : `Import ${validRows.length} expense${validRows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
