import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/attendance/access";
import { incentiveSession, listPlacements } from "@/lib/incentives/data";

type RouteContext = { params: Promise<{ id: string }> };

/** POST { action: "approve" | "reject", note? } — Super Admin only. Only approved placements earn incentive. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const a = await incentiveSession();
  if ("response" in a) return a.response;
  if (!isSuperAdmin(a.session)) return NextResponse.json({ error: "Only a Super Admin can approve placements" }, { status: 403 });

  const { id } = await params;
  const { action, note } = (await req.json().catch(() => ({}))) as { action?: unknown; note?: unknown };
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const row = await prisma.incentivePlacement.findUnique({ where: { id }, select: { id: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.incentivePlacement.update({
    where: { id },
    data: {
      status: action === "approve" ? "approved" : "rejected",
      reviewedById: a.session.userId,
      reviewedAt: new Date(),
      reviewNote: typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null,
    },
  });
  return NextResponse.json(await listPlacements(a.session));
}
