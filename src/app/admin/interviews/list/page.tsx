export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InterviewsView } from "../interviews-view";

export default async function TotalInterviewsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isRecruiter = session.roleName === "Recruiter";

  const [interviews, recruiter, count, mySubmissions] = await Promise.all([
    prisma.interview.findMany({
      where: isRecruiter ? { recruiterId: session.userId } : {},
      select: {
        id: true,
        interviewId: true,
        interviewStartDate: true,
        interviewEndDate: true,
        interviewLevel: true,
        interviewStatus: true,
        techSupportFeedback: true,
        amount: true,
        recruiter: { select: { firstName: true, lastName: true } },
        submission: {
          select: {
            submissionId: true,
            technology: true,
            vendorCompany: true,
            clientName: true,
            clientLocation: true,
            consultant: { select: { firstName: true, lastName: true } },
          },
        },
        techSupport: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    }),
    prisma.interview.count(),
    prisma.submission.findMany({
      where: { recruiterId: session.userId },
      select: {
        id: true,
        submissionId: true,
        technology: true,
        vendorCompany: true,
        vendorRecruiterName: true,
        vendorRecruiterEmail: true,
        vendorRecruiterPhone: true,
        implementationName: true,
        implementationEmail: true,
        implementationPhone: true,
        clientName: true,
        clientLocation: true,
        consultant: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const recruiterName = recruiter
    ? `${recruiter.firstName} ${recruiter.lastName}`
    : session.email;
  const nextInterviewId = `I-${String(count + 1).padStart(3, "0")}`;

  return (
    <InterviewsView
      interviews={interviews}
      recruiterId={session.userId}
      recruiterName={recruiterName}
      nextInterviewId={nextInterviewId}
      mySubmissions={mySubmissions}
    />
  );
}
