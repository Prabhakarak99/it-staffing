import { NextRequest, NextResponse } from "next/server";
import { easyAccess } from "@/lib/easy/access";
import { vendorsFor } from "@/lib/easy/data";

type RouteContext = { params: Promise<{ id: string }> };

/** GET ?consultantId= — vendors for this client / implementation partner not yet used for the consultant */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const access = await easyAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const consultantId = req.nextUrl.searchParams.get("consultantId");
  if (!consultantId) return NextResponse.json({ error: "consultantId is required" }, { status: 400 });

  const data = await vendorsFor(id, consultantId);
  if (!data) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  return NextResponse.json(data);
}
