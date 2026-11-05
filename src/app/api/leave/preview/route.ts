import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDayKey } from "@/lib/attendance/dates";
import { chargedDays, getLeaveBalance, otherLeaveDays, splitPaid } from "@/lib/attendance/leave";

/** GET /api/leave/preview?start=yyyy-mm-dd&end=yyyy-mm-dd — days charged (with sandwich weekends) and the paid/unpaid split */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end") || start;
  if (!isDayKey(start) || !isDayKey(end) || end < start) return NextResponse.json({ error: "Pick valid dates" }, { status: 400 });

  const [other, balance] = await Promise.all([otherLeaveDays(session.userId), getLeaveBalance(session.userId)]);
  if ([...other].some((d) => d >= start && d <= end)) {
    return NextResponse.json({ error: "You already have leave on some of these days" }, { status: 400 });
  }
  const days = chargedDays(start, end, other);
  const { paid, unpaid } = splitPaid(days.length, balance.available - balance.pending);
  return NextResponse.json({ days, totalDays: days.length, paid, unpaid, balance });
}
