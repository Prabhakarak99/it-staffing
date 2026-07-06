import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const interviews = await prisma.interview.findMany({
    include: {
      recruiter: { select: { firstName: true, lastName: true } },
      submission: {
        select: {
          submissionId: true, technology: true,
          vendorCompany: true, clientName: true, clientLocation: true,
          consultant: { select: { firstName: true, lastName: true } },
        },
      },
      techSupport: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(interviews);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      submissionId, interviewStartDate, interviewEndDate,
      interviewLevel, interviewStatus, techSupportId,
      amount, techSupportFeedback, otterLink,
      interviewQuestions, interviewFeedback,
    } = body;

    if (!submissionId || !interviewStartDate || !interviewEndDate || !interviewLevel) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const endDate = new Date(interviewEndDate);
    const statusRequired = new Date() >= endDate;
    if (statusRequired && !interviewStatus) {
      return NextResponse.json({ error: "Interview status is required after the scheduled end time" }, { status: 400 });
    }

    const count = await prisma.interview.count();
    const interviewId = `I-${String(count + 1).padStart(3, "0")}`;

    const interview = await prisma.interview.create({
      data: {
        interviewId,
        recruiterId: session.userId,
        submissionId,
        interviewStartDate: new Date(interviewStartDate),
        interviewEndDate: endDate,
        interviewLevel,
        interviewStatus: interviewStatus || "Scheduled",
        techSupportId: techSupportId || null,
        amount: amount || null,
        techSupportFeedback: techSupportFeedback || null,
        otterLink: otterLink || null,
        interviewQuestions: interviewQuestions || null,
        interviewFeedback: interviewFeedback || null,
      },
      include: {
        recruiter: { select: { firstName: true, lastName: true } },
        submission: {
          select: {
            submissionId: true,
            consultant: { select: { firstName: true, lastName: true } },
          },
        },
        techSupport: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(interview, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
