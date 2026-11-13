import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApprove, reviewableBy } from "@/lib/attendance/access";

/** POST /api/attendance/review { ids: string[], action: "approve" | "reject", note? } — approvers only, never their own; a POC's only by a Super Admin */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canApprove(session)) return NextResponse.json({ error: "Only POC, Manager or Admin can approve attendance" }, { status: 403 });

  const { ids, action, note } = (await req.json()) as { ids?: unknown; action?: unknown; note?: unknown };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) return NextResponse.json({ error: "Select attendance to review" }, { status: 400 });
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { count } = await prisma.attendance.updateMany({
    where: { id: { in: ids.map(String) }, status: "pending", ...reviewableBy(session) },
    data: {
      status: action === "approve" ? "approved" : "rejected",
      reviewedById: session.userId,
      reviewedAt: new Date(),
      reviewNote: typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null,
    },
  });
  return NextResponse.json({ updated: count });
}
