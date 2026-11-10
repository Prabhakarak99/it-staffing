import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVendorAccess } from "@/lib/vendors/access";
import { vendorWithJd } from "@/lib/vendors/matches";
import { consultantScope } from "@/lib/resumes/data";
import { getTailorJob, startTailorJob } from "@/lib/easy/tailor-jobs";

type RouteContext = { params: Promise<{ id: string }> };

/** POST { consultantId } — AI resume for this vendor's JD, in the background; returns a job id to poll */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const found = await vendorWithJd(access, (await params).id);
  if (!found) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  if (!found.jd) return NextResponse.json({ error: "This vendor has no job description. Add one with the pencil icon." }, { status: 400 });

  const { consultantId } = (await req.json().catch(() => ({}))) as { consultantId?: unknown };
  if (typeof consultantId !== "string") return NextResponse.json({ error: "consultantId is required" }, { status: 400 });
  const mine = await prisma.student.findFirst({ where: { id: consultantId, ...consultantScope(access.session) }, select: { id: true } });
  if (!mine) return NextResponse.json({ error: "Consultant not found" }, { status: 404 });

  const { vendor } = found;
  const jobId = startTailorJob({
    consultantId,
    userId: access.session.userId,
    recruiterVendorId: vendor.id,
    jd: {
      text: found.jd,
      jobTitle: found.jdTitle,
      technology: found.jdTechnology ?? vendor.technologies?.split(",")[0]?.trim() ?? null,
      clientName: found.jdClient ?? vendor.clients?.split(",")[0]?.trim() ?? null,
    },
  });
  return NextResponse.json({ jobId }, { status: 202 });
}

/** GET ?job= — running | done (with the result) | failed (with the reason) */
export async function GET(req: NextRequest) {
  const access = await getVendorAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const job = getTailorJob(req.nextUrl.searchParams.get("job") ?? "", access.session.userId);
  if (!job) return NextResponse.json({ error: "This update is no longer available. Please try again." }, { status: 404 });
  return NextResponse.json({ status: job.status, result: job.result, error: job.error });
}
