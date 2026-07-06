import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildConsultantComment, checklistProgress, normalizeChecklist, normalizeConsultantComments } from "@/lib/premarketing-checklist";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const { checklist, consultantComment } = body as { checklist?: unknown; consultantComment?: string };

    const existing = await prisma.preMarketing.findUnique({
      where: { id },
      include: { consultant: true },
    });
    if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    if (existing.consultant.projectStatus !== "Pre-Marketing") {
      return NextResponse.json({ error: "Consultant is no longer in Pre-Marketing" }, { status: 400 });
    }

    const normalized = normalizeChecklist(checklist);
    const nextComment = buildConsultantComment(consultantComment ?? "");
    const comments = nextComment
      ? [...normalizeConsultantComments(existing.consultant.comments), nextComment]
      : normalizeConsultantComments(existing.consultant.comments);
    const record = await prisma.$transaction(async (tx) => {
      const saved = await tx.preMarketing.update({
        where: { id },
        data: { checklist: normalized },
        include: {
          consultant: { select: { id: true, firstName: true, lastName: true, email: true, technology: true, projectStatus: true } },
          recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      await tx.student.update({
        where: { id: existing.consultantId },
        data: { comments },
      });
      return saved;
    });

    return NextResponse.json({
      record: { ...record, checklist: normalized },
      consultantComment: "",
      progress: checklistProgress(normalized),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.preMarketing.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
