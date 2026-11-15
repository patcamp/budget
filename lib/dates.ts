// Calendar-date helpers that stay in the user's local timezone.
// Never use Date#toISOString().slice(0, 10) for date-only values — that
// converts to UTC and can shift the calendar day (evening US time, DST).

/** Format a Date as YYYY-MM-DD in local time. Defaults to today. */
export function toLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string as local midnight (not UTC). */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Add `days` to a YYYY-MM-DD string, returning another YYYY-MM-DD. */
export function addDaysLocal(ymd: string, days: number): string {
  const d = parseLocalDate(ymd);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}
