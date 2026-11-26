"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface ToastControls {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastControls | null>(null);

const NOOP_TOAST: ToastControls = {
  showToast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
};

export function useToast(): ToastControls {
  return useContext(ToastContext) ?? NOOP_TOAST;
}

function toastColors(type: ToastType) {
  if (type === "success") {
    return {
      bg: "var(--success-bg)",
      border: "var(--success-border)",
      text: "var(--success-text)",
      icon: "✓",
    };
  }
  if (type === "error") {
    return {
      bg: "var(--danger-bg)",
      border: "var(--danger-border)",
      text: "var(--danger-text)",
      icon: "!",
    };
  }
  return {
    bg: "var(--bg-panel)",
    border: "var(--border-strong)",
    text: "var(--text)",
    icon: "i",
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setToasts((prev) => {
        const next = [...prev, { id, message, type }];
        if (next.length > 4) {
          const evicted = next.slice(0, next.length - 4);
          for (const item of evicted) {
            const timer = timersRef.current.get(item.id);
            if (timer != null) {
              window.clearTimeout(timer);
              timersRef.current.delete(item.id);
            }
          }
          return next.slice(-4);
        }
        return next;
      });

      const duration = type === "error" ? 6000 : 3800;
      const timer = window.setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const controls = useMemo<ToastControls>(
    () => ({
      showToast,
      success: (message: string) => showToast(message, "success"),
      error: (message: string) => showToast(message, "error"),
      info: (message: string) => showToast(message, "info"),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={controls}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
          {toasts.map((t) => {
            const palette = toastColors(t.type);
            return (
              <div
                key={t.id}
                role={t.type === "error" ? "alert" : "status"}
                className="toast-item"
                style={{
                  background: palette.bg,
                  border: `1px solid ${palette.border}`,
                  color: palette.text,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `1px solid ${palette.border}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {palette.icon}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.35, color: "var(--text)" }}>
                  {t.message}
                </span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="tap-target"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: "4px 6px",
                    margin: "-4px -4px -4px 0",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}
