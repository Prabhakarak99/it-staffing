import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { isManager } from "@/lib/roles";
import { listFollowUps } from "@/lib/followups/data";
import { FollowUpError, sendFollowUp } from "@/lib/followups/send";
import { FOLLOWUPS_SCREEN } from "@/lib/followups/templates";

async function access() {
  const session = await getSession();
  if (!session) return { denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canViewScreen(session, FOLLOWUPS_SCREEN.path))) {
    return { denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** GET ?scope=mine|all — today's follow-ups; "all" (every recruiter) is for managers */
export async function GET(req: NextRequest) {
  const { session, denied } = await access();
  if (denied) return denied;
  const all = req.nextUrl.searchParams.get("scope") === "all" && isManager(session);
  return NextResponse.json(await listFollowUps(all ? null : session.userId));
}

/** POST { kind: "submission" | "interview", id } — sends the due follow-up from the recruiter's own mailbox */
export async function POST(req: NextRequest) {
  const { session, denied } = await access();
  if (denied) return denied;
  const { kind, id } = (await req.json().catch(() => ({}))) as { kind?: unknown; id?: unknown };
  if ((kind !== "submission" && kind !== "interview") || typeof id !== "string") {
    return NextResponse.json({ error: "Choose a submission or interview" }, { status: 400 });
  }
  try {
    return NextResponse.json(await sendFollowUp(session.userId, kind, id));
  } catch (err) {
    if (err instanceof FollowUpError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[follow-ups]", err);
    return NextResponse.json({ error: "Could not send the follow-up" }, { status: 500 });
  }
}
