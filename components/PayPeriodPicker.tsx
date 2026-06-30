"use client";

import { PayPeriod } from "@/lib/types";

interface Props {
  periods: PayPeriod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNext: () => void;
  busy: boolean;
}

export default function PayPeriodPicker({ periods, selectedId, onSelect, onCreateNext, busy }: Props) {
  function formatRange(p: PayPeriod) {
    const start = new Date(p.start_date + "T00:00:00");
    const end = new Date(p.end_date + "T00:00:00");
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {periods.map((p) => {
          const active = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
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
      <button
        onClick={onCreateNext}
        disabled={busy || periods.length === 0}
        style={{
          padding: "7px 14px",
          borderRadius: 7,
          border: "1px dashed #334155",
          background: "transparent",
          color: "#94A3B8",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        + New Pay Period
      </button>
    </div>
  );
}
