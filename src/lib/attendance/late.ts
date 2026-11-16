// Late-login rule. No server imports: the attendance grid uses these too.
import { dayKeyOf } from "@/lib/tz";

/** The rule applies from this attendance day; earlier days are never late */
export const LATE_RULE_START = "2026-11-17";
/** Login time and the last minute that still counts as on time, both India time (IST) */
export const LOGIN_TIME_LABEL = "7:30 PM IST";
export const LATE_AFTER_LABEL = "7:40 PM IST";
// 7:40 PM IST is 14:10 UTC (IST has no daylight saving); 7:41 PM onwards is late
const LATE_FROM_UTC_MINUTES = 14 * 60 + 11;

interface Mark { day: Date; markedAt: Date; reviewedAt: Date | null; reviewNote: string | null }

/**
 * When the employee marked themselves in, or null when there is no real entry time: a row an admin
 * created ("Set to present by admin") carries the admin's click time, and a mark made on another
 * Central day is not that day's entry.
 */
export function entryTime(a: Mark): Date | null {
  const byAdmin = !!a.reviewNote?.startsWith("Set to") && !!a.reviewedAt && Math.abs(a.reviewedAt.getTime() - a.markedAt.getTime()) < 5_000;
  return !byAdmin && dayKeyOf(a.markedAt) === a.day.toISOString().slice(0, 10) ? a.markedAt : null;
}

/** Marked in after 7:40 PM IST on that day (the IST evening that is the same calendar date as the Central day) */
export function isLate(dayKey: string, entry: Date | null): boolean {
  if (!entry || dayKey < LATE_RULE_START) return false;
  const [y, m, d] = dayKey.split("-").map(Number);
  return entry.getTime() >= Date.UTC(y, m - 1, d, 0, LATE_FROM_UTC_MINUTES);
}

/**
 * Leave charged for late days in one calendar month: the 2nd late day costs half a day, the 3rd makes
 * it one full day, and it repeats from there (5 late days = 1.5, 6 = 2).
 */
export const lateLeaveDays = (lateDays: number) => Math.floor(lateDays / 3) + (lateDays % 3 === 2 ? 0.5 : 0);
