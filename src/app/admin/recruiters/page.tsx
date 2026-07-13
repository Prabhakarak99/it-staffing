export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { RecruitersView } from "./recruiters-view";

const consultantSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  personalPhone: true,
  technology: true,
  visaStatus: true,
  projectStatus: true,
} as const;

const submissionSelect = {
  id: true,
  submissionId: true,
  recruiterId: true,
  consultantId: true,
  clientName: true,
  vendorCompany: true,
  createdAt: true,
  status: true,
  consultant: { select: consultantSelect },
  interviews: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      interviewId: true,
      createdAt: true,
      interviewStatus: true,
    },
  },
} as const;

function mapSubmissions(
  submissions: Array<{
    id: string;
    submissionId: string;
    clientName: string | null;
    vendorCompany: string | null;
    createdAt: Date;
    status: string;
    interviews: Array<{
      id: string;
      interviewId: string;
      createdAt: Date;
      interviewStatus: string;
    }>;
  }>
) {
  return submissions.map((submission) => ({
    id: submission.id,
    submissionId: submission.submissionId,
    clientName: submission.clientName,
    vendorCompany: submission.vendorCompany,
    createdAt: submission.createdAt.toISOString(),
    status: submission.status,
    interviews: submission.interviews.map((interview) => ({
      id: interview.id,
      interviewId: interview.interviewId,
      createdAt: interview.createdAt.toISOString(),
      interviewStatus: interview.interviewStatus,
    })),
  }));
}

export default async function RecruitersPage() {
  const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });

  const [recruiters, roles] = await Promise.all([
    prisma.user.findMany({
      where: recruiterRole ? { roleId: recruiterRole.id } : {},
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  const recruiterIds = recruiters.map((recruiter) => recruiter.id);

  const [assignments, allSubmissions] = recruiterIds.length > 0
    ? await Promise.all([
        prisma.preMarketing.findMany({
          where: { recruiterId: { in: recruiterIds } },
          orderBy: [{ marketingStartDate: "desc" }, { updatedAt: "desc" }],
          select: {
            recruiterId: true,
            marketingStartDate: true,
            marketingVisaStatus: true,
            consultant: { select: consultantSelect },
          },
        }),
        prisma.submission.findMany({
          where: { recruiterId: { in: recruiterIds } },
          orderBy: { createdAt: "desc" },
          select: submissionSelect,
        }),
      ])
    : [[], []];

  const submissionsByPair = new Map<string, typeof allSubmissions>();
  for (const submission of allSubmissions) {
    const key = `${submission.recruiterId}:${submission.consultantId}`;
    const current = submissionsByPair.get(key) ?? [];
    current.push(submission);
    submissionsByPair.set(key, current);
  }

  const preMarketingByRecruiterConsultant = new Map(
    assignments.map((assignment) => [
      `${assignment.recruiterId}:${assignment.consultant.id}`,
      assignment,
    ])
  );

  const recruitersWithAssignments = recruiters.map((recruiter) => {
    const candidateIds = new Set<string>();

    for (const assignment of assignments) {
      if (assignment.recruiterId === recruiter.id) {
        candidateIds.add(assignment.consultant.id);
      }
    }

    for (const submission of allSubmissions) {
      if (submission.recruiterId === recruiter.id) {
        candidateIds.add(submission.consultantId);
      }
    }

    const assignedCandidates = [...candidateIds]
      .map((consultantId) => {
        const preMarketing = preMarketingByRecruiterConsultant.get(`${recruiter.id}:${consultantId}`);
        const consultant =
          preMarketing?.consultant
          ?? allSubmissions.find(
            (submission) => submission.recruiterId === recruiter.id && submission.consultantId === consultantId
          )?.consultant;

        if (!consultant) return null;

        return {
          id: consultant.id,
          firstName: consultant.firstName,
          lastName: consultant.lastName,
          email: consultant.email,
          personalPhone: consultant.personalPhone,
          technology: consultant.technology,
          originalVisaStatus: consultant.visaStatus,
          marketingVisaStatus: preMarketing?.marketingVisaStatus ?? null,
          projectStatus: consultant.projectStatus,
          marketingStartDate: preMarketing?.marketingStartDate?.toISOString() ?? null,
          submissions: mapSubmissions(submissionsByPair.get(`${recruiter.id}:${consultantId}`) ?? []),
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

    return { ...recruiter, assignedCandidates };
  });

  return <RecruitersView recruiters={recruitersWithAssignments} roles={roles} />;
}
