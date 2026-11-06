import { NextRequest, NextResponse } from "next/server";
import { easyAccess } from "@/lib/easy/access";
import { getTailorJob, startTailorJob } from "@/lib/easy/tailor-jobs";

type RouteContext = { params: Promise<{ id: string }> };

/** POST { consultantId } — starts the AI resume update for this submission's JD; returns a job id to poll */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await easyAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const { consultantId } = (await req.json()) as { consultantId?: unknown };
  if (typeof consultantId !== "string") return NextResponse.json({ error: "consultantId is required" }, { status: 400 });

  return NextResponse.json({ jobId: startTailorJob(id, consultantId, access.session.userId) }, { status: 202 });
}

/** GET ?job= — status of a running update: running | done (with the result) | failed (with the reason) */
export async function GET(req: NextRequest) {
  const access = await easyAccess();
  if (!access.ok) return access.response;

  const job = getTailorJob(req.nextUrl.searchParams.get("job") ?? "", access.session.userId);
  if (!job) return NextResponse.json({ error: "This update is no longer available. Please try again." }, { status: 404 });
  return NextResponse.json({ status: job.status, result: job.result, error: job.error });
}
