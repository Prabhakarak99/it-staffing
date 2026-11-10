import { NextRequest, NextResponse } from "next/server";
import { getVendorAccess } from "@/lib/vendors/access";
import { sendResumeToVendor } from "@/lib/vendors/matches";

export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

/** POST { consultantId, subject, body, useTailored } — email the consultant's resume to this vendor */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const body = typeof b.body === "string" ? b.body : "";
  if (typeof b.consultantId !== "string") return NextResponse.json({ error: "consultantId is required" }, { status: 400 });
  if (!subject || !body.trim()) return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  try {
    return NextResponse.json(
      await sendResumeToVendor(access, (await params).id, { consultantId: b.consultantId, subject, body, useTailored: b.useTailored !== false }),
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send" }, { status: 400 });
  }
}
