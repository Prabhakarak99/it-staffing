import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canSeeAllLeads } from "@/lib/leads/access";
import { getTeamSheetUrl, loadTeamSheet, setTeamSheetUrl } from "@/lib/leads/team-sheet";

export const maxDuration = 60;

/** GET /api/leads/team-sheet — the shared sheet's link, and whether this user may change it */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ url: await getTeamSheetUrl(), canManage: canSeeAllLeads(session) });
}

/** PUT { url | null } — managers: set (or remove) the team sheet */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSeeAllLeads(session)) return NextResponse.json({ error: "Only an admin or manager can set the team sheet" }, { status: 403 });
  try {
    const { url } = (await req.json()) as { url?: unknown };
    const res = await setTeamSheetUrl(typeof url === "string" && url.trim() ? url.trim() : null);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ url: res.url, canManage: true });
  } catch (err) {
    console.error("[team-sheet] save failed:", err);
    return NextResponse.json({ error: "Could not save the team sheet" }, { status: 500 });
  }
}

/** POST — load rows from the team sheet (own rows for a recruiter, everyone's for a manager) */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const res = await loadTeamSheet(session);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json(res);
  } catch (err) {
    console.error("[team-sheet] load failed:", err);
    return NextResponse.json({ error: "Could not load the team sheet" }, { status: 500 });
  }
}
