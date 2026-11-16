import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/attendance/access";

/** PATCH { kind: "award" | "bonus", id, paid } — mark a monthly award or a bonus Paid / Pending (Super Admin only) */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Only a Super Admin can change the payment status" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; id?: unknown; paid?: unknown };
  if ((body.kind !== "award" && body.kind !== "bonus") || typeof body.id !== "string" || typeof body.paid !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const data = body.paid ? { paidAt: new Date(), paidById: session.userId } : { paidAt: null, paidById: null };
  const { count } = body.kind === "award"
    ? await prisma.appreciationAward.updateMany({ where: { id: body.id }, data })
    : await prisma.appreciationBonus.updateMany({ where: { id: body.id }, data });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, paidAt: data.paidAt?.toISOString() ?? null });
}
