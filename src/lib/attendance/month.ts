import { prisma } from "@/lib/prisma";
import { entryTime, isLate, lateLeaveDays } from "./late";
import { ATTENDANCE_START, addDays, dateToKey, eachDay, isWeekend, keyToDate, monthRange, todayKey, weekday } from "./dates";

export type DayStatus =
  | "present"        // attendance approved
  | "pending"        // attendance marked, waiting for approval
  | "leave"          // approved paid leave
  | "unpaid"         // approved leave beyond the balance (LOP)
  | "leave-pending"  // leave requested, waiting for approval
  | "absent"         // past working day without approved attendance or leave
  | "weekend"
  | "today"          // today, not marked yet
  | "future"
  | "none";          // before attendance tracking started for this person

export interface DayCell {
  day: string;
  status: DayStatus;
  /** Weekend charged because the Friday and Monday around it are leave / absent */
  sandwich?: boolean;
  /** When the employee marked themselves in that day (ISO); absent when an admin set the day instead */
  markedAt?: string;
  /** Marked in after 7:40 PM IST (rule from 2026-11-17) */
  late?: boolean;
}

export interface MonthSummary {
  calendarDays: number;
  workingDays: number;
  present: number;
  absent: number;
  paidLeave: number;
  unpaidLeave: number;
  pending: number;
  /** Days marked in late this month, and the leave charged for them (2 = half a day, 3 = one day) */
  lateDays: number;
  lateLeave: number;
}

export interface MonthView {
  month: string;
  days: DayCell[];
  summary: MonthSummary;
}

const NOT_WORKED = new Set<DayStatus>(["absent", "leave", "unpaid"]);

/** One employee's month: a status per day and the totals for the summary cards */
export async function buildMonth(userId: string, month: string, trackFrom?: string): Promise<MonthView> {
  const { first, last, days: calendarDays } = monthRange(month);
  const today = todayKey();
  const start = trackFrom && trackFrom > ATTENDANCE_START ? trackFrom : ATTENDANCE_START;

  // A few days either side so weekends on the month edges can see their Friday / Monday
  const from = addDays(first, -3);
  const to = addDays(last, 3);

  const [attendance, leaves] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, day: { gte: keyToDate(from), lte: keyToDate(to) } },
      select: { day: true, status: true, markedAt: true, reviewedAt: true, reviewNote: true },
    }),
    prisma.leaveRequest.findMany({
      where: { userId, status: { in: ["pending", "approved"] }, startDate: { lte: keyToDate(to) }, endDate: { gte: keyToDate(addDays(from, -2)) } },
      select: { days: true, status: true, paidDays: true },
    }),
  ]);

  const marks = new Map(attendance.map((a) => [dateToKey(a.day), a.status]));
  // Entry time: only when the employee marked in on that same Central day. A row an admin created
  // ("Set to present by admin") carries the admin's click time, which is not an entry time.
  const entryAt = new Map<string, Date>();
  for (const a of attendance) {
    const entry = entryTime(a);
    if (entry) entryAt.set(dateToKey(a.day), entry);
  }
  const leaveByDay = new Map<string, DayStatus>();
  for (const l of leaves) {
    l.days.forEach((d, i) => {
      leaveByDay.set(d, l.status === "pending" ? "leave-pending" : i < l.paidDays ? "leave" : "unpaid");
    });
  }

  const baseStatus = (k: string): DayStatus => {
    const leave = leaveByDay.get(k);
    if (leave) return leave;
    if (k > today) return "future";
    // A mark (or an admin's change) counts even before tracking started, so admins can backfill
    const mark = marks.get(k);
    if (mark === "approved") return "present";
    if (mark === "pending") return "pending";
    if (mark === "rejected") return isWeekend(k) ? "weekend" : "absent";
    if (k < start) return "none";
    if (isWeekend(k)) return "weekend";
    return k === today ? "today" : "absent";
  };

  const cells: DayCell[] = eachDay(first, last).map((day) => {
    const status = baseStatus(day);
    const entry = status === "present" || status === "pending" ? entryAt.get(day) : undefined;
    if (status !== "weekend") return entry ? { day, status, markedAt: entry.toISOString(), ...(isLate(day, entry) ? { late: true } : {}) } : { day, status };
    // Sandwich: Friday and Monday around this weekend both not worked → the weekend counts too
    const friday = weekday(day) === 6 ? addDays(day, -1) : addDays(day, -2);
    const monday = weekday(day) === 6 ? addDays(day, 2) : addDays(day, 1);
    if (monday > today) return { day, status };
    const fri = baseStatus(friday);
    const mon = baseStatus(monday);
    if (NOT_WORKED.has(fri) && NOT_WORKED.has(mon)) return { day, status: "absent", sandwich: true };
    return { day, status };
  });

  const count = (s: DayStatus) => cells.filter((c) => c.status === s).length;
  const lateDays = cells.filter((c) => c.late).length;
  return {
    month,
    days: cells,
    summary: {
      calendarDays,
      workingDays: cells.filter((c) => !isWeekend(c.day)).length,
      present: count("present"),
      absent: count("absent"),
      paidLeave: count("leave"),
      unpaidLeave: count("unpaid"),
      pending: count("pending") + count("leave-pending"),
      lateDays,
      lateLeave: lateLeaveDays(lateDays),
    },
  };
}
