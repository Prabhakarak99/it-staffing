import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checklistProgress, normalizeChecklist } from "@/lib/premarketing-checklist";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const { marketingStartDate, recruiterId, marketingVisaStatus } = body as {
      marketingStartDate?: string;
      recruiterId?: string;
      marketingVisaStatus?: string;
    };

    if (!marketingStartDate) {
      return NextResponse.json({ error: "Marketing start date is required" }, { status: 400 });
    }
    if (!recruiterId) {
      return NextResponse.json({ error: "Recruiter is required" }, { status: 400 });
    }
    if (!marketingVisaStatus) {
      return NextResponse.json({ error: "Marketing visa is required" }, { status: 400 });
    }

    const record = await prisma.preMarketing.findUnique({
      where: { id },
      include: { consultant: true },
    });
    if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });

    const checklist = normalizeChecklist(record.checklist);
    const progress = checklistProgress(checklist);
    if (!progress.isComplete) {
      return NextResponse.json({ error: "All checklist items must be completed first" }, { status: 400 });
    }

    const [updatedRecord] = await prisma.$transaction([
      prisma.preMarketing.update({
        where: { id },
        data: {
          marketingStartDate: new Date(marketingStartDate),
          marketingVisaStatus,
          recruiterId,
        },
        include: {
          consultant: { select: { id: true, firstName: true, lastName: true, email: true, technology: true } },
          recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.student.update({
        where: { id: record.consultantId },
        data: { projectStatus: "In-Market" },
      }),
    ]);

    return NextResponse.json({
      record: { ...updatedRecord, checklist },
      message: `${record.consultant.firstName} ${record.consultant.lastName} moved to In-Market`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to complete pre-marketing" }, { status: 500 });
  }
}
