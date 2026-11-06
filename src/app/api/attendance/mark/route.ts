import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marksAttendance } from "@/lib/attendance/access";
import { keyToDate, todayKey } from "@/lib/attendance/dates";
import { quoteForDay } from "@/lib/attendance/quotes";

/** POST /api/attendance/mark { note? } — "Yes, I'm in" for today (Central date); goes to the approvers */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!marksAttendance(session)) return NextResponse.json({ error: "This account doesn't mark attendance" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { note?: unknown };
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const today = todayKey();
  const day = keyToDate(today);

  const existing = await prisma.attendance.findUnique({ where: { userId_day: { userId: session.userId, day } } });
  if (existing) return NextResponse.json({ status: existing.status, day: today, alreadyMarked: true });

  const quote = await quoteForDay(today);
  try {
    const row = await prisma.attendance.create({
      data: { userId: session.userId, day, note, quoteId: quote?.id ?? null },
    });
    return NextResponse.json({ status: row.status, day: today }, { status: 201 });
  } catch {
    // Two tabs marking at once: the unique (userId, day) keeps one
    return NextResponse.json({ status: "pending", day: today, alreadyMarked: true });
  }
}
