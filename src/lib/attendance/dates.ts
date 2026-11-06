// Attendance dates are US Central calendar days (see src/lib/tz.ts), passed around as "yyyy-mm-dd" keys and stored as DATE
// (UTC midnight). No server imports: the attendance grid uses these too.

import { APP_TZ } from "@/lib/tz";

export const ATTENDANCE_TZ = APP_TZ;

/** First day attendance is tracked; earlier days are never shown as absent */
export const ATTENDANCE_START = "2026-11-06";

/** Paid leave accrues from this month (1 per month) */
export const ACCRUAL_START_MONTH = "2026-11";

const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: ATTENDANCE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in Central time */
export const todayKey = (now = new Date()) => keyFormat.format(now);

export const keyToDate = (key: string) => new Date(`${key}T00:00:00.000Z`);
export const dateToKey = (d: Date) => d.toISOString().slice(0, 10);

export const isDayKey = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(keyToDate(v).getTime()) && dateToKey(keyToDate(v)) === v;

export const addDays = (key: string, n: number) => {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToKey(d);
};

/** 0 = Sunday … 6 = Saturday */
export const weekday = (key: string) => keyToDate(key).getUTCDay();
export const isWeekend = (key: string) => weekday(key) === 0 || weekday(key) === 6;

/** Every key from start to end inclusive */
export function eachDay(start: string, end: string) {
  const out: string[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

/** "yyyy-mm" */
export const monthOf = (key: string) => key.slice(0, 7);
export const isMonthKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = dateToKey(new Date(Date.UTC(y, m, 0)));
  return { first, last, days: Number(last.slice(8)) };
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return dateToKey(d).slice(0, 7);
}

/** Whole months from `from` to `to` inclusive ("yyyy-mm"); 0 when `to` is earlier */
export function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm) + 1);
}

export const fmtDayKey = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  keyToDate(key).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

export const fmtMonth = (month: string) =>
  keyToDate(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
