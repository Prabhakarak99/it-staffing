import { NextRequest, NextResponse } from "next/server";
import { disconnectConsultant } from "@/lib/gmail/oauth";
import { consultantMailAccess } from "@/lib/consultant-mail/data";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE — disconnect the consultant's Gmail (access is revoked at Google too) */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const access = await consultantMailAccess(id);
  if (!access.ok) return access.response;
  await disconnectConsultant(id);
  return NextResponse.json({ success: true });
}
