import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { isManager } from "@/lib/roles";
import { canViewScreen } from "@/lib/screen-access";

export const RESUMES_SCREEN = { name: "Resumes", path: "/admin/resumes" };

/** Recruiters see the consultants assigned to them (Pre-Marketing); POC / Manager / Admin see everyone */
export function consultantScope(session: SessionPayload): Prisma.StudentWhereInput {
  return isManager(session) ? {} : { preMarketings: { some: { recruiterId: session.userId } } };
}

type Access = { ok: false; response: NextResponse } | { ok: true; session: SessionPayload };

/** Signed in, can open Resumes, and (with a consultant id) that consultant is theirs */
export async function resumesAccess(consultantId?: string): Promise<Access> {
  const session = await getSession();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canViewScreen(session, RESUMES_SCREEN.path))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (consultantId) {
    const found = await prisma.student.findFirst({ where: { id: consultantId, ...consultantScope(session) }, select: { id: true } });
    if (!found) return { ok: false, response: NextResponse.json({ error: "Consultant not found" }, { status: 404 }) };
  }
  return { ok: true, session };
}

const fullName = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}`.trim() : null);

/** The consultants on the Resumes tab, with their uploaded resume and how many AI resumes they have */
export async function listResumeConsultants(session: SessionPayload) {
  const rows = await prisma.student.findMany({
    where: consultantScope(session),
    select: {
      id: true, firstName: true, lastName: true, technology: true, projectStatus: true,
      resumeFile: true, resumeFileName: true, resumeUpdatedAt: true,
      preMarketings: { select: { recruiter: { select: { firstName: true, lastName: true } } }, take: 1 },
      _count: { select: { tailoredResumes: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`.trim(),
    technology: s.technology,
    status: s.projectStatus,
    recruiterName: fullName(s.preMarketings[0]?.recruiter),
    resume: s.resumeFile
      ? { file: s.resumeFile, name: s.resumeFileName ?? "Resume", updatedAt: s.resumeUpdatedAt?.toISOString() ?? null }
      : null,
    aiCount: s._count.tailoredResumes,
  }));
}

export type ResumeConsultant = Awaited<ReturnType<typeof listResumeConsultants>>[number];

/** Every AI resume for one consultant, newest first, with the JD it was written for */
export async function listAiResumes(consultantId: string) {
  const rows = await prisma.tailoredResume.findMany({
    where: { consultantId },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      submission: { select: { submissionId: true, technology: true, clientName: true, jobDescription: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((t) => ({
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    jobTitle: t.jobTitle,
    clientName: t.clientName ?? t.submission?.clientName ?? null,
    technology: t.technology ?? t.submission?.technology ?? null,
    // Resumes made before the JD was stored with them fall back to the submission's JD
    jobDescription: t.jobDescription ?? t.submission?.jobDescription ?? null,
    jd: t.jdFile ? { file: t.jdFile, name: t.jdFileName ?? "Job description" } : null,
    submissionCode: t.submission?.submissionId ?? null,
    resume: { file: t.file, name: t.fileName },
    atsBefore: t.atsBefore,
    atsAfter: t.atsAfter,
    model: t.model,
    createdBy: fullName(t.createdBy),
  }));
}

export type AiResumeRow = Awaited<ReturnType<typeof listAiResumes>>[number];
