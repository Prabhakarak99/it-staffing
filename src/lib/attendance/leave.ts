import { prisma } from "@/lib/prisma";
import { ACCRUAL_START_MONTH, addDays, dateToKey, eachDay, isWeekend, keyToDate, monthOf, monthsBetween, todayKey, weekday } from "./dates";
import { LATE_RULE_START, entryTime, isLate, lateLeaveDays } from "./late";

/**
 * Days a leave request is charged for: every Mon–Fri in the range, plus "sandwich" weekends, where
 * the Friday before and the Monday after are both leave. A weekend between this request and an
 * existing (pending or approved) one is charged to this request, so Fri + Mon leave = 4 days.
 */
export function chargedDays(start: string, end: string, otherLeave: Set<string>) {
  const range = eachDay(start, end);
  const inRange = new Set(range.filter((k) => !isWeekend(k)));
  const isLeave = (k: string) => inRange.has(k) || otherLeave.has(k);

  const charged = new Set(inRange);
  // Weekends inside the range, plus the one just before a Monday start / after a Friday end
  const candidates = new Set(range.filter(isWeekend));
  if (weekday(start) === 1) [addDays(start, -1), addDays(start, -2)].forEach((k) => candidates.add(k));
  if (weekday(end) === 5) [addDays(end, 1), addDays(end, 2)].forEach((k) => candidates.add(k));

  for (const k of candidates) {
    if (otherLeave.has(k)) continue; // already charged to another request
    const friday = weekday(k) === 6 ? addDays(k, -1) : addDays(k, -2);
    const monday = weekday(k) === 6 ? addDays(k, 2) : addDays(k, 1);
    if (isLeave(friday) && isLeave(monday)) charged.add(k);
  }
  return [...charged].sort();
}

/** Days already covered by this user's pending or approved leave, optionally leaving one request out */
export async function otherLeaveDays(userId: string, excludeId?: string) {
  const rows = await prisma.leaveRequest.findMany({
    where: { userId, status: { in: ["pending", "approved"] }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { days: true },
  });
  return new Set(rows.flatMap((r) => r.days));
}

export interface LeaveBalance {
  /** 1 per month from the later of the accrual start and the employee's joining month */
  accrued: number;
  used: number;
  /** Paid days held by pending requests */
  pending: number;
  /** Leave charged for late logins so far (each month: 2 late days = half a day, 3 = one day) */
  latePenalty: number;
  available: number;
}

export async function getLeaveBalance(userId: string): Promise<LeaveBalance> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { startDate: true, createdAt: true } });
  const joined = user ? monthOf(dateToKey(user.startDate ?? user.createdAt)) : ACCRUAL_START_MONTH;
  const from = joined > ACCRUAL_START_MONTH ? joined : ACCRUAL_START_MONTH;
  const accrued = monthsBetween(from, monthOf(todayKey()));

  const [approved, pendingRows, marks] = await Promise.all([
    prisma.leaveRequest.aggregate({ where: { userId, status: "approved" }, _sum: { paidDays: true } }),
    prisma.leaveRequest.findMany({ where: { userId, status: "pending" }, select: { totalDays: true } }),
    prisma.attendance.findMany({
      where: { userId, status: { in: ["approved", "pending"] }, day: { gte: keyToDate(LATE_RULE_START) } },
      select: { day: true, markedAt: true, reviewedAt: true, reviewNote: true },
    }),
  ]);
  // Late days are counted per calendar month, then turned into leave
  const lateByMonth = new Map<string, number>();
  for (const a of marks) {
    const key = dateToKey(a.day);
    if (isLate(key, entryTime(a))) lateByMonth.set(monthOf(key), (lateByMonth.get(monthOf(key)) ?? 0) + 1);
  }
  const latePenalty = [...lateByMonth.values()].reduce((n, late) => n + lateLeaveDays(late), 0);
  const used = approved._sum.paidDays ?? 0;
  const pending = pendingRows.reduce((n, r) => n + r.totalDays, 0);
  return { accrued, used, pending, latePenalty, available: Math.max(0, accrued - used - latePenalty) };
}

/** Paid / unpaid split for `total` days given the current balance */
export function splitPaid(total: number, available: number) {
  // Leave is taken in whole days, so a half day left over (after a late-login charge) cannot pay for one
  const paid = Math.min(total, Math.floor(Math.max(0, available)));
  return { paid, unpaid: total - paid };
}
