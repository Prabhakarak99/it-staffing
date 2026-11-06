import { prisma } from "@/lib/prisma";
import { dateToKey, keyToDate, todayKey } from "./dates";
import { getLeaveBalance, type LeaveBalance } from "./leave";
import { buildMonth, type DayCell, type MonthSummary } from "./month";

export interface TeamMonthRow {
  userId: string;
  name: string;
  email: string;
  roleName: string | null;
  days: DayCell[];
  summary: MonthSummary;
  balance: LeaveBalance;
}

/** Kept off the team grid and its Excel sheet: the CEO role and demo accounts */
const notTracked = [
  { role: { name: { contains: "CEO", mode: "insensitive" as const } } },
  { firstName: { contains: "demo", mode: "insensitive" as const } },
  { lastName: { contains: "demo", mode: "insensitive" as const } },
  { email: { contains: "demo", mode: "insensitive" as const } },
];

/** Every active employee with a role (except CEOs and demo accounts): days, totals and leave balance for one month */
export async function getTeamMonth(month: string): Promise<TeamMonthRow[]> {
  const users = await prisma.user.findMany({
    where: { roleId: { not: null }, isActive: true, NOT: notTracked },
    select: { id: true, firstName: true, lastName: true, email: true, startDate: true, createdAt: true, role: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return Promise.all(
    users.map(async (u) => {
      const [m, balance] = await Promise.all([buildMonth(u.id, month, dateToKey(u.startDate ?? u.createdAt)), getLeaveBalance(u.id)]);
      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        roleName: u.role?.name ?? null,
        days: m.days,
        summary: m.summary,
        balance,
      };
    }),
  );
}

export interface TodayPerson {
  id: string;
  name: string;
  /** Present: marked today and approved, or still waiting for approval */
  pending?: boolean;
  /** Absent: on approved leave */
  onLeave?: boolean;
}

/** Who is in today (Central date), for the dashboard: same people as the team grid */
export async function getTodayAttendance() {
  const today = todayKey();
  const [users, marks, leaves] = await Promise.all([
    prisma.user.findMany({
      where: { roleId: { not: null }, isActive: true, NOT: notTracked },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.attendance.findMany({ where: { day: keyToDate(today), status: { in: ["approved", "pending"] } }, select: { userId: true, status: true } }),
    prisma.leaveRequest.findMany({ where: { status: "approved", days: { has: today } }, select: { userId: true } }),
  ]);
  const marked = new Map(marks.map((m) => [m.userId, m.status]));
  const onLeave = new Set(leaves.map((l) => l.userId));

  const present: TodayPerson[] = [];
  const absent: TodayPerson[] = [];
  for (const u of users) {
    const person = { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() };
    const status = marked.get(u.id);
    if (status) present.push({ ...person, pending: status === "pending" });
    else absent.push({ ...person, onLeave: onLeave.has(u.id) });
  }
  return { present, absent, total: users.length };
}
