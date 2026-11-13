import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/attendance/access";

/** DELETE — remove a bonus added by mistake (Super Admin only) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Only a Super Admin can remove a bonus" }, { status: 403 });
  await prisma.appreciationBonus.deleteMany({ where: { id: (await params).id } });
  return NextResponse.json({ ok: true });
}
