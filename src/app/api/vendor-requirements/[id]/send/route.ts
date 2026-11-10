import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { VENDOR_REQ_SCREEN } from "@/lib/requirements/constants";
import { RequirementError, sendForRequirement } from "@/lib/requirements/matches";

export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

/** POST { consultantId, subject, body } — email the consultant's JD-updated resume to the requirement's vendor */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canViewScreen(session, VENDOR_REQ_SCREEN.path))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const body = typeof b.body === "string" ? b.body : "";
  if (typeof b.consultantId !== "string") return NextResponse.json({ error: "consultantId is required" }, { status: 400 });
  if (!subject || !body.trim()) return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  try {
    return NextResponse.json(await sendForRequirement(session, (await params).id, { consultantId: b.consultantId, subject, body }));
  } catch (err) {
    if (err instanceof RequirementError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[requirement-send]", err);
    return NextResponse.json({ error: "Could not send" }, { status: 500 });
  }
}
