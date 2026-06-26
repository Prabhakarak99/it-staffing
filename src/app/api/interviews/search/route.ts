import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const consultantId = req.nextUrl.searchParams.get("consultantId") ?? "";

  if (q.length < 3) return NextResponse.json([]);

  const interviews = await prisma.interview.findMany({
    where: consultantId
      ? { interviewId: { contains: q }, submission: { consultantId } }
      : { interviewId: { contains: q } },
    select: {
      id: true,
      interviewId: true,
      interviewStatus: true,
      interviewStartDate: true,
      submission: { select: { submissionId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(interviews);
}
