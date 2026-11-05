import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marksAttendance } from "@/lib/attendance/access";
import { addDays, isDayKey, keyToDate, todayKey } from "@/lib/attendance/dates";
import { chargedDays, otherLeaveDays } from "@/lib/attendance/leave";

/** Leave can be requested up to this many days back (e.g. sick leave entered after the fact) */
const BACKDATE_DAYS = 31;
const MAX_DAYS = 60;

/** POST /api/leave { startDate, endDate, reason } — goes to the approvers; paid/unpaid is settled on approval */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!marksAttendance(session)) return NextResponse.json({ error: "This account doesn't take leave" }, { status: 400 });

  const body = (await req.json()) as { startDate?: unknown; endDate?: unknown; reason?: unknown };
  const start = body.startDate;
  const end = body.endDate || start;
  if (!isDayKey(start) || !isDayKey(end) || end < start) return NextResponse.json({ error: "Pick a valid start and end date" }, { status: 400 });
  if (start < addDays(todayKey(), -BACKDATE_DAYS)) return NextResponse.json({ error: `Leave can only be requested up to ${BACKDATE_DAYS} days back` }, { status: 400 });

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (!reason) return NextResponse.json({ error: "Please add a reason" }, { status: 400 });

  const other = await otherLeaveDays(session.userId);
  if ([...other].some((d) => d >= start && d <= end)) {
    return NextResponse.json({ error: "You already have leave on some of these days" }, { status: 400 });
  }
  const days = chargedDays(start, end, other);
  if (days.length === 0) return NextResponse.json({ error: "These dates are only weekend days" }, { status: 400 });
  if (days.length > MAX_DAYS) return NextResponse.json({ error: `A single request can cover at most ${MAX_DAYS} days` }, { status: 400 });

  const leave = await prisma.leaveRequest.create({
    data: { userId: session.userId, startDate: keyToDate(start), endDate: keyToDate(end), days, totalDays: days.length, reason },
  });
  return NextResponse.json(leave, { status: 201 });
}
