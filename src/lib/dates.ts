/** Calendar date helpers — avoid timezone off-by-one on date-only fields. */

/** Parse YYYY-MM-DD from <input type="date"> as UTC midnight for that calendar day. */
export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date: ${value}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

/** Extract YYYY-MM-DD from a stored date without local timezone shift. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a date-only value for display (e.g. Dec 20, 2026). */
export function formatDateOnly(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
): string {
  const part = toDateInputValue(value);
  if (!part) return "—";
  const [y, m, d] = part.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", options);
}
