// sessionStorage helpers for in-progress form drafts.
// Survives remounts (tab switches inside the app, auth churn) and soft
// page kills when switching to another app — cleared on successful submit.

export function readDraft<T>(key: string): T | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, value: unknown): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota — draft persistence is best-effort.
  }
}

export function clearDraft(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
