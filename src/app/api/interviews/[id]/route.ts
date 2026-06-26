import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const interview = await prisma.interview.update({
    where: { id },
    data: {
      interviewStatus: body.interviewStatus ?? undefined,
      interviewLevel: body.interviewLevel ?? undefined,
      interviewStartDate: body.interviewStartDate ? new Date(body.interviewStartDate) : undefined,
      interviewEndDate: body.interviewEndDate ? new Date(body.interviewEndDate) : undefined,
      techSupportId: body.techSupportId ?? undefined,
      amount: body.amount ?? undefined,
      techSupportFeedback: body.techSupportFeedback ?? undefined,
      otterLink: body.otterLink ?? undefined,
      interviewQuestions: body.interviewQuestions ?? undefined,
      interviewFeedback: body.interviewFeedback ?? undefined,
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
