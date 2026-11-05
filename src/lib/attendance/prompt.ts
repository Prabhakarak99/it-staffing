import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { marksAttendance } from "./access";
import { fmtDayKey, keyToDate, todayKey } from "./dates";
import { quoteForDay } from "./quotes";

export interface AttendancePromptData {
  firstName: string;
  dayLabel: string;
  quote: { text: string; author: string | null } | null;
}

/** The first-login-of-the-day popup: shown until today's attendance is marked (skipped on a leave day) */
export async function getAttendancePrompt(session: SessionPayload, firstName: string): Promise<AttendancePromptData | null> {
  if (!marksAttendance(session)) return null;
  const today = todayKey();
  const [marked, onLeave] = await Promise.all([
    prisma.attendance.findUnique({ where: { userId_day: { userId: session.userId, day: keyToDate(today) } }, select: { id: true } }),
    prisma.leaveRequest.findFirst({ where: { userId: session.userId, status: { in: ["pending", "approved"] }, days: { has: today } }, select: { id: true } }),
  ]);
  if (marked || onLeave) return null;
  const quote = await quoteForDay(today);
  return {
    firstName,
    dayLabel: fmtDayKey(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    quote: quote ? { text: quote.text, author: quote.author } : null,
  };
}
