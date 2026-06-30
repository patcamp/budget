"use client";

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
  function applyPreset(n: number | "all") {
    const ids = n === "all" ? periods.map((p) => p.id) : periods.slice(-n).map((p) => p.id);
    onChange(ids);
  }

  function togglePeriod(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {[
          { label: "Last 3", n: 3 as number | "all" },
          { label: "Last 6", n: 6 as number | "all" },
          { label: "All Time", n: "all" as number | "all" },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.n)}
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              border: "1px dashed #334155",
              background: "transparent",
              color: "#94A3B8",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                borderColor: active ? "#3B82F6" : "#1E293B",
                background: active ? "#1D4ED8" : "#0F1825",
                color: active ? "#fff" : "#64748B",
              }}
            >
              {p.is_locked && <span style={{ fontSize: 10 }}>🔒</span>}
              {formatRange(p)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
