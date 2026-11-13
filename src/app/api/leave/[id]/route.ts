import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApprove, isPocRole, isSuperAdmin } from "@/lib/attendance/access";
import { dateToKey } from "@/lib/attendance/dates";
import { chargedDays, getLeaveBalance, otherLeaveDays, splitPaid } from "@/lib/attendance/leave";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/leave/:id { action: "approve" | "reject" | "cancel", note? }
 * Approvers approve or reject others' requests; the employee can cancel their own pending one.
 * On approval the days are recounted and split into paid (from the balance) and unpaid.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, note } = (await req.json()) as { action?: unknown; note?: unknown };
  const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { user: { select: { role: { select: { name: true } } } } } });
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (leave.status !== "pending") return NextResponse.json({ error: `This request is already ${leave.status}` }, { status: 409 });

  if (action === "cancel") {
    if (leave.userId !== session.userId) return NextResponse.json({ error: "Only the employee can cancel" }, { status: 403 });
    return NextResponse.json(await prisma.leaveRequest.update({ where: { id }, data: { status: "cancelled" } }));
  }

  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (!canApprove(session)) return NextResponse.json({ error: "Only POC, Manager or Admin can approve leave" }, { status: 403 });
  if (leave.userId === session.userId) return NextResponse.json({ error: "You can't approve your own leave" }, { status: 403 });
  if (isPocRole(leave.user.role?.name) && !isSuperAdmin(session)) {
    return NextResponse.json({ error: "A POC's leave can only be approved by a Super Admin" }, { status: 403 });
  }

  const review = {
    reviewedById: session.userId,
    reviewedAt: new Date(),
    reviewNote: typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null,
  };

  if (action === "reject") {
    return NextResponse.json(await prisma.leaveRequest.update({ where: { id }, data: { status: "rejected", ...review } }));
  }

  // Recount against what is approved / pending now (another request may have been cancelled meanwhile)
  const days = chargedDays(dateToKey(leave.startDate), dateToKey(leave.endDate), await otherLeaveDays(leave.userId, leave.id));
  const balance = await getLeaveBalance(leave.userId);
  const { paid, unpaid } = splitPaid(days.length, balance.available);

  return NextResponse.json(
    await prisma.leaveRequest.update({
      where: { id },
      data: { status: "approved", days, totalDays: days.length, paidDays: paid, unpaidDays: unpaid, ...review },
    }),
  );
}
