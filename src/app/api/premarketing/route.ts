import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  buildConsultantComment,
  emptyChecklist,
  checklistProgress,
  normalizeChecklist,
  normalizeConsultantComments,
  type PreMarketingChecklist,
} from "@/lib/premarketing-checklist";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const consultants = await prisma.student.findMany({
    where: { projectStatus: "Pre-Marketing" },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      technology: true,
      projectStatus: true,
      comments: true,
      preMarketings: {
        include: {
          recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  const records = consultants.map((consultant) => {
    const record = consultant.preMarketings[0] ?? null;
    const checklist = normalizeChecklist(record?.checklist);
    const progress = checklistProgress(checklist);
    return {
      consultant: {
        id: consultant.id,
        firstName: consultant.firstName,
        lastName: consultant.lastName,
        email: consultant.email,
        technology: consultant.technology,
        projectStatus: consultant.projectStatus,
      },
      consultantComment: "",
      record: record
        ? {
            id: record.id,
            checklist,
            marketingStartDate: record.marketingStartDate,
            marketingEndDate: record.marketingEndDate,
            recruiter: record.recruiter,
            updatedAt: record.updatedAt,
          }
        : null,
      progress,
    };
  });

  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { consultantId, checklist, consultantComment } = body as {
      consultantId?: string;
      checklist?: PreMarketingChecklist;
      consultantComment?: string;
    };

    if (!consultantId) {
      return NextResponse.json({ error: "Consultant is required" }, { status: 400 });
    }

    const consultant = await prisma.student.findUnique({ where: { id: consultantId } });
    if (!consultant) return NextResponse.json({ error: "Consultant not found" }, { status: 404 });
    if (consultant.projectStatus !== "Pre-Marketing") {
      return NextResponse.json({ error: "Consultant is not in Pre-Marketing status" }, { status: 400 });
    }

    const existing = await prisma.preMarketing.findFirst({ where: { consultantId } });
    const normalized =
      checklist === undefined
        ? existing
          ? normalizeChecklist(existing.checklist)
          : emptyChecklist()
        : normalizeChecklist(checklist);
    const nextComment = buildConsultantComment(consultantComment ?? "");
    const comments = nextComment
      ? [...normalizeConsultantComments(consultant.comments), nextComment]
      : normalizeConsultantComments(consultant.comments);
    const include = {
      consultant: { select: { id: true, firstName: true, lastName: true, email: true, technology: true } },
      recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
    };
    const record = await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.preMarketing.update({
            where: { id: existing.id },
            data: { checklist: normalized },
            include,
          })
        : await tx.preMarketing.create({
            data: { consultantId, checklist: normalized },
            include,
          });

      await tx.student.update({
        where: { id: consultantId },
        data: { comments },
      });

      return saved;
    });

    return NextResponse.json({
      record: { ...record, checklist: normalizeChecklist(record.checklist) },
      consultantComment: "",
      progress: checklistProgress(normalized),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save checklist" }, { status: 500 });
  }
}
