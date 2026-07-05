import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
      consultant: { select: { id: true, firstName: true, lastName: true, email: true, technology: true } },
      interviews: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          interviewId: true,
          interviewStartDate: true,
          interviewLevel: true,
          interviewStatus: true,
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (session.roleName === "Recruiter" && submission.recruiterId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(submission);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const submission = await prisma.submission.update({
    where: { id },
    data: {
      ...(body.consultantId !== undefined && { consultantId: body.consultantId }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.technology !== undefined && { technology: body.technology }),
      ...(body.jobDescription !== undefined && { jobDescription: body.jobDescription }),
      ...(body.payRate !== undefined && { payRate: body.payRate }),
      ...(body.vendorCompany !== undefined && { vendorCompany: body.vendorCompany }),
      ...(body.vendorRecruiterName !== undefined && { vendorRecruiterName: body.vendorRecruiterName }),
      ...(body.vendorRecruiterEmail !== undefined && { vendorRecruiterEmail: body.vendorRecruiterEmail }),
      ...(body.vendorRecruiterPhone !== undefined && { vendorRecruiterPhone: body.vendorRecruiterPhone }),
      ...(body.implementationName !== undefined && { implementationName: body.implementationName }),
      ...(body.implementationEmail !== undefined && { implementationEmail: body.implementationEmail }),
      ...(body.implementationPhone !== undefined && { implementationPhone: body.implementationPhone }),
      ...(body.clientName !== undefined && { clientName: body.clientName }),
      ...(body.clientLocation !== undefined && { clientLocation: body.clientLocation }),
    },
    include: {
      recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
      consultant: { select: { id: true, firstName: true, lastName: true, email: true, technology: true } },
    },
  });

  return NextResponse.json(submission);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await prisma.submission.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
