import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { VENDOR_REQ_SCREEN } from "@/lib/requirements/constants";
import { RequirementError, tailorInputFor } from "@/lib/requirements/matches";
import { getTailorJob, startTailorJob } from "@/lib/easy/tailor-jobs";

type RouteContext = { params: Promise<{ id: string }> };

async function access() {
  const session = await getSession();
  if (!session) return { denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if (!(await canViewScreen(session, VENDOR_REQ_SCREEN.path))) return { denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { session } as const;
}

/** POST { consultantId } — AI resume for this requirement's JD, in the background; returns a job id to poll */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const a = await access();
  if ("denied" in a) return a.denied;
  const { consultantId } = (await req.json().catch(() => ({}))) as { consultantId?: unknown };
  if (typeof consultantId !== "string") return NextResponse.json({ error: "consultantId is required" }, { status: 400 });
  try {
    const input = await tailorInputFor(a.session, (await params).id, consultantId);
    return NextResponse.json({ jobId: startTailorJob(input) }, { status: 202 });
  } catch (err) {
    if (err instanceof RequirementError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

/** GET ?job= — running | done (with the result) | failed (with the reason) */
export async function GET(req: NextRequest) {
  const a = await access();
  if ("denied" in a) return a.denied;
  const job = getTailorJob(req.nextUrl.searchParams.get("job") ?? "", a.session.userId);
  if (!job) return NextResponse.json({ error: "This update is no longer available. Please try again." }, { status: 404 });
  return NextResponse.json({ status: job.status, result: job.result, error: job.error });
}
