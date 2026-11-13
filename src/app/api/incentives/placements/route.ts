import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseConfirmation } from "@/lib/profit-sharing/data";
import { incentiveSession, listPlacements, parseBillRate, reviewFor } from "@/lib/incentives/data";

export async function GET() {
  const a = await incentiveSession();
  if ("response" in a) return a.response;
  return NextResponse.json(await listPlacements(a.session));
}

/** POST { submissionRefId, interviewRefId?, confirmationDate, startDate?, endDate?, billRate?, rate?, … } */
export async function POST(req: NextRequest) {
  const a = await incentiveSession();
  if ("response" in a) return a.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseConfirmation(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const rate = parseBillRate(body.billRate);
  if ("error" in rate) return NextResponse.json({ error: rate.error }, { status: 400 });

  const submission = typeof body.submissionRefId === "string"
    ? await prisma.submission.findUnique({
        where: { id: body.submissionRefId },
        include: { consultant: { select: { firstName: true, lastName: true } }, interviews: { select: { id: true, interviewId: true } } },
      })
    : null;
  if (!submission) return NextResponse.json({ error: "Load a submission first" }, { status: 400 });
  if (!a.all && submission.recruiterId !== a.session.userId) {
    return NextResponse.json({ error: `${submission.submissionId} is not your submission` }, { status: 403 });
  }
  if (await prisma.incentivePlacement.findUnique({ where: { submissionRefId: submission.id }, select: { id: true } })) {
    return NextResponse.json({ error: `${submission.submissionId} already has a placement. Edit that one instead.` }, { status: 409 });
  }
  const interview = submission.interviews.find((i) => i.id === body.interviewRefId) ?? null;

  await prisma.incentivePlacement.create({
    data: {
      ...parsed.data,
      billRate: rate.billRate,
      submissionRefId: submission.id,
      submissionCode: submission.submissionId,
      interviewRefId: interview?.id ?? null,
      interviewCode: interview?.interviewId ?? null,
      recruiterId: submission.recruiterId,
      consultantId: submission.consultantId,
      consultantName: `${submission.consultant.firstName} ${submission.consultant.lastName}`.replace(/\s+/g, " ").trim(),
      createdById: a.session.userId,
      ...reviewFor(a.session),
    },
  });
  return NextResponse.json(await listPlacements(a.session), { status: 201 });
}
