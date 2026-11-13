import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listConfirmations, parseConfirmation, profitSession } from "@/lib/profit-sharing/data";

export async function GET() {
  const a = await profitSession();
  if ("response" in a) return a.response;
  return NextResponse.json(await listConfirmations());
}

/** POST { submissionRefId, interviewRefId?, confirmationDate, startDate?, endDate?, rate?, clientName?, … } */
export async function POST(req: NextRequest) {
  const a = await profitSession();
  if ("response" in a) return a.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseConfirmation(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const submission = typeof body.submissionRefId === "string"
    ? await prisma.submission.findUnique({
        where: { id: body.submissionRefId },
        include: { consultant: { select: { firstName: true, lastName: true } }, interviews: { select: { id: true, interviewId: true } } },
      })
    : null;
  if (!submission) return NextResponse.json({ error: "Load a submission first" }, { status: 400 });
  if (await prisma.confirmation.findUnique({ where: { submissionRefId: submission.id }, select: { id: true } })) {
    return NextResponse.json({ error: `${submission.submissionId} already has a confirmation. Edit that one instead.` }, { status: 409 });
  }
  const interview = submission.interviews.find((i) => i.id === body.interviewRefId) ?? null;

  await prisma.confirmation.create({
    data: {
      ...parsed.data,
      submissionRefId: submission.id,
      submissionCode: submission.submissionId,
      interviewRefId: interview?.id ?? null,
      interviewCode: interview?.interviewId ?? null,
      consultantId: submission.consultantId,
      consultantName: `${submission.consultant.firstName} ${submission.consultant.lastName}`.replace(/\s+/g, " ").trim(),
      createdById: a.session.userId,
    },
  });
  return NextResponse.json(await listConfirmations(), { status: 201 });
}
