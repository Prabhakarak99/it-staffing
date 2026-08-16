import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const applications = await prisma.autoJobApplication.findMany({
    where: { runId: id },
    orderBy: { createdAt: "asc" },
    include: {
      consultant: { select: { firstName: true, lastName: true, technology: true } },
      vendorContact: {
        select: { vendorCompany: true, recruiterName: true, email: true, clientName: true },
      },
    },
  });

  return NextResponse.json(
    applications.map((app) => ({
      id: app.id,
      consultantName: `${app.consultant.firstName} ${app.consultant.lastName}`.trim(),
      consultantTechnology: app.consultant.technology,
      vendorCompany: app.vendorContact.vendorCompany,
      vendorRecruiter: app.vendorContact.recruiterName,
      vendorEmail: app.vendorContact.email,
      emailStatus: app.emailStatus,
      errorMessage: app.errorMessage,
      sentAt: app.sentAt,
      createdAt: app.createdAt,
    }))
  );
}
