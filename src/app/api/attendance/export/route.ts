import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApprove } from "@/lib/attendance/access";
import { dateToKey, fmtDayKey, fmtMonth, isMonthKey, keyToDate, monthOf, monthRange, todayKey } from "@/lib/attendance/dates";
import type { DayStatus } from "@/lib/attendance/month";
import { getTeamMonth } from "@/lib/attendance/team";

export const maxDuration = 60;

// Cell code and colour (ARGB) per day status, same meaning as the on-screen grid
const CODE: Record<DayStatus, { text: string; fill?: string; font?: string }> = {
  present: { text: "P", fill: "FFD1FAE5", font: "FF047857" },
  absent: { text: "A", fill: "FFFFE4E6", font: "FFBE123C" },
  pending: { text: "P?", fill: "FFFEF3C7", font: "FFB45309" },
  leave: { text: "L", fill: "FFE0F2FE", font: "FF0369A1" },
  unpaid: { text: "LOP", fill: "FFFFEDD5", font: "FFC2410C" },
  "leave-pending": { text: "L?", fill: "FFEDE9FE", font: "FF6D28D9" },
  weekend: { text: "WO", fill: "FFF1F5F9", font: "FF94A3B8" },
  today: { text: "–" },
  future: { text: "" },
  none: { text: "" },
};

const HEADER_FILL = "FF1E293B";

/** GET /api/attendance/export?month=yyyy-mm — every employee's month as an Excel workbook */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canApprove(session)) return NextResponse.json({ error: "Only POC, Manager or Admin can download attendance" }, { status: 403 });

  const param = req.nextUrl.searchParams.get("month");
  const month = isMonthKey(param) ? param : monthOf(todayKey());
  const { first, last } = monthRange(month);

  const [team, leaves] = await Promise.all([
    getTeamMonth(month),
    prisma.leaveRequest.findMany({
      where: { startDate: { lte: keyToDate(last) }, endDate: { gte: keyToDate(first) }, status: { not: "cancelled" } },
      include: { user: { select: { firstName: true, lastName: true, email: true } }, reviewedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "GFT Vision";
  wb.created = new Date();

  // ── Sheet 1: attendance grid ──
  const ws = wb.addWorksheet("Attendance", { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
  const days = team[0]?.days.map((d) => d.day) ?? [];
  const totals = ["Calendar Days", "Working Days", "Present", "Absent", "Paid Leave", "Unpaid Leave", "Pending", "Leave Balance"];

  ws.addRow([`Attendance — ${fmtMonth(month)}`]).font = { bold: true, size: 14 };
  ws.addRow(["P = Present · A = Absent · P? = Awaiting approval · L = Paid leave · LOP = Unpaid leave · L? = Leave requested · WO = Weekend · * = sandwich weekend"]).font = { italic: true, size: 9, color: { argb: "FF64748B" } };

  const header = ws.addRow(["Employee", "Email", "Role", ...days.map((d) => fmtDayKey(d, { day: "numeric", weekday: "narrow" })), ...totals]);
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  header.height = 30;

  for (const r of team) {
    const row = ws.addRow([
      r.name,
      r.email,
      r.roleName ?? "",
      ...r.days.map((d) => `${CODE[d.status].text}${d.sandwich ? "*" : ""}`),
      r.summary.calendarDays,
      r.summary.workingDays,
      r.summary.present,
      r.summary.absent,
      r.summary.paidLeave,
      r.summary.unpaidLeave,
      r.summary.pending,
      r.balance.available,
    ]);
    r.days.forEach((d, i) => {
      const cell = row.getCell(4 + i);
      const code = CODE[d.status];
      cell.alignment = { horizontal: "center" };
      if (code.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: code.fill } };
      if (code.font) cell.font = { bold: d.status !== "weekend", color: { argb: code.font }, size: 10 };
    });
    for (let i = 0; i < totals.length; i++) row.getCell(4 + days.length + i).alignment = { horizontal: "center" };
  }

  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 14;
  days.forEach((_, i) => (ws.getColumn(4 + i).width = 5));
  totals.forEach((_, i) => (ws.getColumn(4 + days.length + i).width = 11));

  // ── Sheet 2: leave requests touching the month ──
  const ls = wb.addWorksheet("Leave Requests", { views: [{ state: "frozen", ySplit: 1 }] });
  ls.columns = [
    { header: "Employee", key: "name", width: 24 },
    { header: "Email", key: "email", width: 30 },
    { header: "From", key: "from", width: 14 },
    { header: "To", key: "to", width: 14 },
    { header: "Days", key: "days", width: 8 },
    { header: "Paid", key: "paid", width: 8 },
    { header: "Unpaid", key: "unpaid", width: 8 },
    { header: "Status", key: "status", width: 12 },
    { header: "Reason", key: "reason", width: 40 },
    { header: "Reviewed By", key: "reviewer", width: 22 },
    { header: "Review Note", key: "note", width: 30 },
  ];
  ls.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });
  for (const l of leaves) {
    ls.addRow({
      name: `${l.user.firstName} ${l.user.lastName}`.trim(),
      email: l.user.email,
      from: dateToKey(l.startDate),
      to: dateToKey(l.endDate),
      days: l.totalDays,
      paid: l.status === "approved" ? l.paidDays : "",
      unpaid: l.status === "approved" ? l.unpaidDays : "",
      status: l.status,
      reason: l.reason ?? "",
      reviewer: l.reviewedBy ? `${l.reviewedBy.firstName} ${l.reviewedBy.lastName}`.trim() : "",
      note: l.reviewNote ?? "",
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${month}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
