import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/attendance/access";
import { MAX_BONUS, isBonusReason } from "@/lib/appreciation/bonus";

/** POST { userId, reason, otherReason?, consultantId?, amount } — Super Admin only */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Only a Super Admin can add a bonus" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_BONUS) return NextResponse.json({ error: "Enter the amount in rupees" }, { status: 400 });
  if (!isBonusReason(body.reason)) return NextResponse.json({ error: "Choose a reason" }, { status: 400 });

  const user = typeof body.userId === "string" ? await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } }) : null;
  if (!user) return NextResponse.json({ error: "Choose who gets the bonus" }, { status: 400 });

  const otherReason = typeof body.otherReason === "string" ? body.otherReason.trim().slice(0, 200) : "";
  if (body.reason === "other" && !otherReason) return NextResponse.json({ error: "Type what the bonus is for" }, { status: 400 });

  let consultant: { id: string; firstName: string; lastName: string } | null = null;
  if (body.reason === "placement") {
    consultant = typeof body.consultantId === "string"
      ? await prisma.student.findUnique({ where: { id: body.consultantId }, select: { id: true, firstName: true, lastName: true } })
      : null;
    if (!consultant) return NextResponse.json({ error: "Choose the consultant who was placed" }, { status: 400 });
  }

  await prisma.appreciationBonus.create({
    data: {
      userId: user.id,
      reason: body.reason,
      otherReason: body.reason === "other" ? otherReason : null,
      consultantId: consultant?.id ?? null,
      consultantName: consultant ? `${consultant.firstName} ${consultant.lastName}`.replace(/\s+/g, " ").trim() : null,
      amount: Math.round(amount * 100) / 100,
      createdById: session.userId,
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
