import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { VENDOR_REQ_SCREEN } from "@/lib/requirements/constants";
import { matchedForRequirement } from "@/lib/requirements/matches";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — the user's In-Market consultants on this requirement's technology, with their AI resume for it */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canViewScreen(session, VENDOR_REQ_SCREEN.path))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const found = await matchedForRequirement(session, (await params).id);
  if (!found) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  return NextResponse.json(found);
}
