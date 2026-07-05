import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { emptyChecklist } from "@/lib/premarketing-checklist";

type RouteContext = { params: Promise<{ id: string }> };

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || "Lead";
  return { firstName, lastName };
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const emailTaken = await prisma.student.findUnique({ where: { email: lead.email } });
    if (emailTaken) {
      return NextResponse.json({ error: "A consultant with this email already exists" }, { status: 409 });
    }

    const { firstName, lastName } = splitName(lead.consultantName);
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Lead name is incomplete" }, { status: 400 });
    }

    const commentPayload = lead.comments?.trim()
      ? [
          {
            source: "lead" as const,
            scope: "consultant" as const,
            note: lead.comments.trim(),
            updatedAt: new Date().toISOString(),
          },
        ]
      : [];

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          firstName,
          lastName,
          email: lead.email,
          personalPhone: lead.phoneNumber ?? null,
          phoneNumber: lead.phoneNumber ?? null,
          projectStatus: "Pre-Marketing",
          comments: commentPayload,
        },
      });

      await tx.preMarketing.create({
        data: {
          consultantId: created.id,
          checklist: emptyChecklist(),
        },
      });

      await tx.lead.delete({ where: { id: lead.id } });

      return created;
    });

    return NextResponse.json({
      success: true,
      consultantId: student.id,
      consultantName: `${student.firstName} ${student.lastName}`,
      message: `${student.firstName} ${student.lastName} moved to Pre-Marketing`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to convert lead" }, { status: 500 });
  }
}
