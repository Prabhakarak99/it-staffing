import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewScreen } from "@/lib/screen-access";
import { ATTENDANCE_SCREEN, canApprove, canEditAttendance, marksAttendance } from "@/lib/attendance/access";
import { dateToKey, isMonthKey, monthOf, todayKey } from "@/lib/attendance/dates";
import { getLeaveBalance } from "@/lib/attendance/leave";
import { buildMonth } from "@/lib/attendance/month";
import { getTeamMonth, type TeamMonthRow } from "@/lib/attendance/team";
import { AttendanceView, type ApprovalData, type LeaveRow } from "./attendance-view";

export const dynamic = "force-dynamic";

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

const toLeaveRow = (l: {
  id: string; startDate: Date; endDate: Date; totalDays: number; paidDays: number; unpaidDays: number;
  reason: string | null; status: string; reviewNote: string | null; createdAt: Date;
  reviewedBy?: { firstName: string; lastName: string } | null;
}): LeaveRow => ({
  id: l.id,
  startDate: dateToKey(l.startDate),
  endDate: dateToKey(l.endDate),
  totalDays: l.totalDays,
  paidDays: l.paidDays,
  unpaidDays: l.unpaidDays,
  reason: l.reason,
  status: l.status,
  reviewNote: l.reviewNote,
  reviewedBy: l.reviewedBy ? fullName(l.reviewedBy) : null,
  createdAt: l.createdAt.toISOString(),
});

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, ATTENDANCE_SCREEN.path))) redirect("/admin");

  const sp = await searchParams;
  const approver = canApprove(session);
  const month = isMonthKey(sp.month) ? sp.month : monthOf(todayKey());
  // Super Admin has no attendance of their own, so starts on the Team grid
  const hasOwnCalendar = marksAttendance(session);
  const requested = sp.tab ?? (!hasOwnCalendar && !sp.user ? "team" : "my");
  const tab = approver && (requested === "approvals" || requested === "team") ? requested : "my";

  // Approvers can open any employee's calendar from the Team tab
  const viewUserId = tab === "my" && approver && sp.user ? sp.user : session.userId;
  const viewUser = await prisma.user.findUnique({
    where: { id: viewUserId },
    select: { id: true, firstName: true, lastName: true, email: true, startDate: true, createdAt: true },
  });
  if (!viewUser) redirect("/admin/attendance");
  const trackFrom = dateToKey(viewUser.startDate ?? viewUser.createdAt);

  const [monthView, balance, leaves] = await Promise.all([
    buildMonth(viewUser.id, month, trackFrom),
    getLeaveBalance(viewUser.id),
    prisma.leaveRequest.findMany({
      where: { userId: viewUser.id },
      include: { reviewedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  let approvals: ApprovalData | null = null;
  let team: TeamMonthRow[] | null = null;

  if (approver && tab === "approvals") {
    const [attendance, leaveRequests] = await Promise.all([
      prisma.attendance.findMany({
        where: { status: "pending", userId: { not: session.userId } },
        include: { user: { select: { firstName: true, lastName: true, email: true } }, quote: { select: { text: true } } },
        orderBy: [{ day: "desc" }, { markedAt: "asc" }],
        take: 300,
      }),
      prisma.leaveRequest.findMany({
        where: { status: "pending", userId: { not: session.userId } },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const balances = new Map(
      await Promise.all([...new Set(leaveRequests.map((l) => l.userId))].map(async (id) => [id, await getLeaveBalance(id)] as const)),
    );
    approvals = {
      attendance: attendance.map((a) => ({
        id: a.id,
        day: dateToKey(a.day),
        name: fullName(a.user),
        email: a.user.email,
        markedAt: a.markedAt.toISOString(),
        note: a.note,
      })),
      leave: leaveRequests.map((l) => ({
        ...toLeaveRow(l),
        userId: l.userId,
        name: fullName(l.user),
        email: l.user.email,
        available: balances.get(l.userId)?.available ?? 0,
      })),
    };
  }

  if (approver && tab === "team") team = await getTeamMonth(month);

  return (
    <AttendanceView
      tab={tab}
      month={month}
      today={todayKey()}
      approver={approver}
      canEdit={canEditAttendance(session)}
      hasOwnCalendar={hasOwnCalendar}
      canRequestLeave={viewUser.id === session.userId && marksAttendance(session)}
      viewing={viewUser.id === session.userId ? null : { id: viewUser.id, name: fullName(viewUser), email: viewUser.email }}
      monthView={monthView}
      balance={balance}
      leaves={leaves.map(toLeaveRow)}
      approvals={approvals}
      team={team}
    />
  );
}
