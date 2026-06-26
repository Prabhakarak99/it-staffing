import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await prisma.preMarketing.findMany({
    include: {
      consultant: { select: { id: true, firstName: true, lastName: true, email: true, technology: true } },
      recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      consultantId,
      dlAvailable,
      visaAvailable,
      ssnAvailable,
      marketingSheetReady,
      marketingSheetExplained,
      marketingSheetReverseKT,
      allTrainingSessionsCompleted,
      allTrainingAssignmentsCompleted,
      marketingEmail,
      marketingVisaStatus,
      marketingStartDate,
      marketingEndDate,
      recruiterId,
    } = body;

    if (!consultantId) {
      return NextResponse.json({ error: "Consultant is required" }, { status: 400 });
    }

    if (marketingStartDate && !recruiterId) {
      return NextResponse.json({ error: "Recruiter is required when Marketing Start Date is set" }, { status: 400 });
    }

    const record = await prisma.preMarketing.create({
      data: {
        consultantId,
        dlAvailable: dlAvailable || null,
        visaAvailable: visaAvailable || null,
        ssnAvailable: ssnAvailable || null,
        marketingSheetReady: marketingSheetReady || null,
        marketingSheetExplained: marketingSheetExplained || null,
        marketingSheetReverseKT: marketingSheetReverseKT || null,
        allTrainingSessionsCompleted: allTrainingSessionsCompleted || null,
        allTrainingAssignmentsCompleted: allTrainingAssignmentsCompleted || null,
        marketingEmail: marketingEmail || null,
        marketingVisaStatus: marketingVisaStatus || null,
        marketingStartDate: marketingStartDate ? new Date(marketingStartDate) : null,
        marketingEndDate: marketingEndDate ? new Date(marketingEndDate) : null,
        recruiterId: recruiterId || null,
      },
      include: {
        consultant: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
