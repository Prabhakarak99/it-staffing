import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditAttendance, isPocRole, isSuperAdmin } from "@/lib/attendance/access";
import { isDayKey, keyToDate, todayKey } from "@/lib/attendance/dates";

/**
 * POST /api/attendance/set { userId, day, status: "present" | "absent" } — admin correction of one day.
 * Stored as an approved / rejected attendance row reviewed by the admin.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditAttendance(session)) return NextResponse.json({ error: "Only administrators can change attendance" }, { status: 403 });

  const { userId, day, status } = (await req.json()) as { userId?: unknown; day?: unknown; status?: unknown };
  if (typeof userId !== "string" || !isDayKey(day)) return NextResponse.json({ error: "Invalid employee or date" }, { status: 400 });
  if (status !== "present" && status !== "absent") return NextResponse.json({ error: "Status must be present or absent" }, { status: 400 });
  if (day > todayKey()) return NextResponse.json({ error: "Future days can't be changed" }, { status: 400 });
  if (userId === session.userId) return NextResponse.json({ error: "You can't change your own attendance" }, { status: 403 });

  const onLeave = await prisma.leaveRequest.findFirst({ where: { userId, status: { in: ["pending", "approved"] }, days: { has: day } }, select: { id: true } });
  if (onLeave) return NextResponse.json({ error: "This day is covered by a leave request; approve, reject or cancel that instead" }, { status: 409 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: { select: { name: true } } } });
  if (!user) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (isPocRole(user.role?.name) && !isSuperAdmin(session)) {
    return NextResponse.json({ error: "A POC's attendance can only be changed by a Super Admin" }, { status: 403 });
  }

  const review = {
    status: status === "present" ? "approved" : "rejected",
    reviewedById: session.userId,
    reviewedAt: new Date(),
    reviewNote: `Set to ${status} by admin`,
  };
  await prisma.attendance.upsert({
    where: { userId_day: { userId, day: keyToDate(day) } },
    create: { userId, day: keyToDate(day), ...review },
    update: review,
  });
  return NextResponse.json({ success: true, day, status });
}
