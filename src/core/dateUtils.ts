/** Local-calendar-day date string, e.g. "2026-07-22". */
export function todayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True if `dateStr` is exactly the calendar day before `today` (both "YYYY-MM-DD"). */
export function isDayBefore(dateStr: string, today: string): boolean {
  const prev = new Date(`${dateStr}T00:00:00`);
  prev.setDate(prev.getDate() + 1);
  return todayDateString(prev) === today;
}
