import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const submission = await prisma.submission.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      technology: body.technology ?? undefined,
      jobDescription: body.jobDescription ?? undefined,
      payRate: body.payRate ?? undefined,
      vendorCompany: body.vendorCompany ?? undefined,
      vendorRecruiterName: body.vendorRecruiterName ?? undefined,
      vendorRecruiterEmail: body.vendorRecruiterEmail ?? undefined,
      vendorRecruiterPhone: body.vendorRecruiterPhone ?? undefined,
      implementationName: body.implementationName ?? undefined,
      implementationEmail: body.implementationEmail ?? undefined,
      implementationPhone: body.implementationPhone ?? undefined,
      clientName: body.clientName ?? undefined,
      clientLocation: body.clientLocation ?? undefined,
    },
    include: {
      recruiter: { select: { firstName: true, lastName: true } },
      consultant: { select: { firstName: true, lastName: true } },
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
