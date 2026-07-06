import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
      submission: {
        select: {
          id: true,
          submissionId: true,
          technology: true,
          vendorCompany: true,
          vendorRecruiterName: true,
          vendorRecruiterEmail: true,
          vendorRecruiterPhone: true,
          implementationName: true,
          implementationEmail: true,
          implementationPhone: true,
          clientName: true,
          clientLocation: true,
          consultant: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      techSupport: {
        select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
      },
    },
  });

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  if (session.roleName === "Recruiter" && interview.recruiterId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(interview);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await prisma.interview.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const endDate = body.interviewEndDate ? new Date(body.interviewEndDate) : existing.interviewEndDate;
  const statusRequired = new Date() >= endDate;
  const nextStatus = body.interviewStatus !== undefined ? body.interviewStatus : existing.interviewStatus;

  if (statusRequired && !nextStatus) {
    return NextResponse.json({ error: "Interview status is required after the scheduled end time" }, { status: 400 });
  }

  const interview = await prisma.interview.update({
    where: { id },
    data: {
      ...(body.submissionId !== undefined && { submissionId: body.submissionId }),
      ...(body.interviewStatus !== undefined && { interviewStatus: body.interviewStatus }),
      ...(body.interviewLevel !== undefined && { interviewLevel: body.interviewLevel }),
      ...(body.interviewStartDate !== undefined && { interviewStartDate: new Date(body.interviewStartDate) }),
      ...(body.interviewEndDate !== undefined && { interviewEndDate: new Date(body.interviewEndDate) }),
      ...(body.techSupportId !== undefined && { techSupportId: body.techSupportId }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.techSupportFeedback !== undefined && { techSupportFeedback: body.techSupportFeedback }),
      ...(body.otterLink !== undefined && { otterLink: body.otterLink }),
      ...(body.interviewQuestions !== undefined && { interviewQuestions: body.interviewQuestions }),
      ...(body.interviewFeedback !== undefined && { interviewFeedback: body.interviewFeedback }),
    },
  });

  return NextResponse.json(interview);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await prisma.interview.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
