"use client";

import { useState } from "react";
import { PayPeriod } from "@/lib/types";

interface Props {
  periods: PayPeriod[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function formatRange(p: PayPeriod) {
  const start = new Date(p.start_date + "T00:00:00");
  const end = new Date(p.end_date + "T00:00:00");
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export default function PeriodFilter({ periods, selectedIds, onChange }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  function applyPreset(count: number | "all") {
    const ids = count === "all" ? periods.map((p) => p.id) : periods.slice(-count).map((p) => p.id);
    onChange(ids);
  }

  function togglePeriod(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  const presets = (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
      {[
        { label: "Last 3", count: 3 as number | "all" },
        { label: "Last 6", count: 6 as number | "all" },
        { label: "All Time", count: "all" as number | "all" },
      ].map((preset) => (
        <button
          key={preset.label}
          onClick={() => applyPreset(preset.count)}
          className="tap-target"
          style={{
            padding: "8px 12px",
            borderRadius: 7,
            border: "1px dashed var(--border-strong)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 44,
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ marginTop: 18 }}>
      {presets}

      {/* Desktop: pills */}
      <div className="hide-mobile" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {periods.map((p) => {
          const active = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => togglePeriod(p.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 7,
                border: "1px solid",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active ? "var(--accent-strong)" : "var(--bg-panel)",
                color: active ? "var(--accent-text)" : "var(--text-muted)",
              }}
            >
              {p.is_locked && <span style={{ fontSize: 10 }}>🔒</span>}
              {formatRange(p)}
            </button>
          );
        })}
      </div>

      {/* Mobile: summary chip → checklist sheet */}
      <div className="show-mobile">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-panel)",
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 48,
          }}
        >
          {selectedIds.length === 0
            ? "No periods selected"
            : selectedIds.length === periods.length
              ? `All ${periods.length} periods`
              : `${selectedIds.length} of ${periods.length} periods`}
          <span style={{ float: "right", color: "var(--text-faint)", fontWeight: 500 }}>Edit</span>
        </button>

        {sheetOpen && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setSheetOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 50,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxHeight: "70vh",
                overflow: "auto",
                background: "var(--bg-panel)",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Select periods</div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "8px 14px",
                    cursor: "pointer",
                    minHeight: 44,
                  }}
                >
                  Done
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {periods.map((p) => {
                  const active = selectedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePeriod(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 12px",
                        borderRadius: 10,
                        border: `1px solid ${active ? "var(--accent)" : "var(--border-soft)"}`,
                        background: active ? "var(--bg-panel-alt)" : "transparent",
                        color: "var(--text)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                        minHeight: 48,
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          background: active ? "var(--accent-strong)" : "transparent",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--accent-text)",
                          fontSize: 12,
                        }}
                      >
                        {active ? "✓" : ""}
                      </span>
                      {p.is_locked ? "🔒 " : ""}
                      {formatRange(p)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
