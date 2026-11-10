import { NextRequest, NextResponse } from "next/server";
import { getVendorAccess } from "@/lib/vendors/access";
import { matchedConsultants } from "@/lib/vendors/matches";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — In-Market consultants on this vendor's technologies, with their AI resume for this vendor */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const found = await matchedConsultants(access, (await params).id);
  if (!found) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  return NextResponse.json(found);
}
