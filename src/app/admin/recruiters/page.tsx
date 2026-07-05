export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { RecruitersView } from "./recruiters-view";

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
  const assignments = recruiterIds.length > 0
    ? await prisma.preMarketing.findMany({
        where: { recruiterId: { in: recruiterIds } },
        orderBy: [{ marketingStartDate: "desc" }, { updatedAt: "desc" }],
        select: {
          recruiterId: true,
          marketingStartDate: true,
          marketingVisaStatus: true,
          consultant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              personalPhone: true,
              technology: true,
              visaStatus: true,
              projectStatus: true,
            },
          },
        },
      })
    : [];

  const consultantIds = [...new Set(assignments.map((assignment) => assignment.consultant.id))];
  const submissions = recruiterIds.length > 0 && consultantIds.length > 0
    ? await prisma.submission.findMany({
        where: {
          recruiterId: { in: recruiterIds },
          consultantId: { in: consultantIds },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          submissionId: true,
          recruiterId: true,
          consultantId: true,
          clientName: true,
          vendorCompany: true,
          createdAt: true,
          status: true,
          interviews: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              interviewId: true,
              createdAt: true,
              interviewStatus: true,
            },
          },
        },
      })
    : [];

  const submissionsByPair = new Map<string, typeof submissions>();
  for (const submission of submissions) {
    const key = `${submission.recruiterId}:${submission.consultantId}`;
    const current = submissionsByPair.get(key) ?? [];
    current.push(submission);
    submissionsByPair.set(key, current);
  }

  const recruitersWithAssignments = recruiters.map((recruiter) => ({
    ...recruiter,
    assignedCandidates: assignments
      .filter((assignment) => assignment.recruiterId === recruiter.id)
      .map((assignment) => ({
        id: assignment.consultant.id,
        firstName: assignment.consultant.firstName,
        lastName: assignment.consultant.lastName,
        email: assignment.consultant.email,
        personalPhone: assignment.consultant.personalPhone,
        technology: assignment.consultant.technology,
        originalVisaStatus: assignment.consultant.visaStatus,
        marketingVisaStatus: assignment.marketingVisaStatus,
        projectStatus: assignment.consultant.projectStatus,
        marketingStartDate: assignment.marketingStartDate?.toISOString() ?? null,
        submissions: (submissionsByPair.get(`${recruiter.id}:${assignment.consultant.id}`) ?? []).map((submission) => ({
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
        })),
      }))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
  }));

  return <RecruitersView recruiters={recruitersWithAssignments} roles={roles} />;
}
