import { NextRequest, NextResponse } from "next/server";
import { easyAccess } from "@/lib/easy/access";
import { MAX_VENDORS_PER_SEND, sendToVendors } from "@/lib/easy/send";

export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

/** POST { consultantId, vendors: [{ email, name, company }], subject, body, useTailored } */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await easyAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const vendors = Array.isArray(body.vendors)
    ? body.vendors
        .filter((v): v is { email: string; name?: string; company?: string } => !!v && typeof (v as { email?: unknown }).email === "string")
        .filter((v) => /\S+@\S+\.\S+/.test(v.email))
        .map((v) => ({ email: v.email.trim(), name: typeof v.name === "string" ? v.name : null, company: typeof v.company === "string" ? v.company : null }))
    : [];

  if (typeof body.consultantId !== "string") return NextResponse.json({ error: "consultantId is required" }, { status: 400 });
  if (vendors.length === 0) return NextResponse.json({ error: "Select at least one vendor" }, { status: 400 });
  if (vendors.length > MAX_VENDORS_PER_SEND) return NextResponse.json({ error: `Send to at most ${MAX_VENDORS_PER_SEND} vendors at a time` }, { status: 400 });
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  if (!subject || !text.trim()) return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });

  try {
    const result = await sendToVendors(access.session.userId, {
      submissionId: id,
      consultantId: body.consultantId,
      vendors,
      subject,
      body: text,
      useTailored: body.useTailored !== false,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send" }, { status: 400 });
  }
}
