import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createAutoJobRun, processAutoJobs } from "@/lib/autojobs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const submissions = await prisma.submission.findMany({
    include: {
      recruiter: { select: { id: true, firstName: true, lastName: true } },
      consultant: { select: { id: true, firstName: true, lastName: true, technology: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(submissions);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      consultantId, technology, jobDescription, payRate,
      vendorCompany, vendorRecruiterName, vendorRecruiterEmail, vendorRecruiterPhone,
      implementationName, implementationEmail, implementationPhone,
      clientName, clientLocation, status,
    } = body;

    if (!consultantId || !technology || !vendorCompany || !vendorRecruiterName || !vendorRecruiterEmail || !vendorRecruiterPhone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auto-generate submission ID: Sub-001, Sub-002, …
    const count = await prisma.submission.count();
    const submissionId = `Sub-${String(count + 1).padStart(3, "0")}`;

    const submission = await prisma.submission.create({
      data: {
        submissionId,
        submissionDate: new Date(),
        recruiterId: session.userId,
        consultantId,
        technology,
        jobDescription: jobDescription || null,
        payRate: payRate || null,
        vendorCompany,
        vendorRecruiterName,
        vendorRecruiterEmail,
        vendorRecruiterPhone,
        implementationName: implementationName || null,
        implementationEmail: implementationEmail || null,
        implementationPhone: implementationPhone || null,
        clientName: clientName || null,
        clientLocation: clientLocation || null,
        status: status || "Submission Submitted",
      },
      include: {
        recruiter: { select: { firstName: true, lastName: true } },
        consultant: { select: { firstName: true, lastName: true } },
      },
    });

    // AutoJobs: queue a vendor-marketing run for this client (fire and forget)
    try {
      const run = await createAutoJobRun(submission);
      if (run) void processAutoJobs();
    } catch (autoJobErr) {
      console.error("[autojobs] failed to queue run:", autoJobErr);
    }

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
