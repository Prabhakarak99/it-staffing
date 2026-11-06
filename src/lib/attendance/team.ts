import { prisma } from "@/lib/prisma";
import { dateToKey } from "./dates";
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
