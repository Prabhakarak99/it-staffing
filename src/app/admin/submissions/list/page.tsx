export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SubmissionsView } from "../submissions-view";

export default async function TotalSubmissionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isRecruiter = session.roleName === "Recruiter";

  const [submissions, recruiter, count] = await Promise.all([
    prisma.submission.findMany({
      where: isRecruiter ? { recruiterId: session.userId } : {},
      select: {
        id: true,
        submissionId: true,
        submissionDate: true,
        technology: true,
        payRate: true,
        vendorCompany: true,
        vendorRecruiterName: true,
        vendorRecruiterEmail: true,
        vendorRecruiterPhone: true,
        clientName: true,
        clientLocation: true,
        status: true,
        createdAt: true,
        recruiter: { select: { firstName: true, lastName: true } },
        consultant: { select: { firstName: true, lastName: true, technology: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    }),
    prisma.submission.count(),
  ]);

  const recruiterName = recruiter
    ? `${recruiter.firstName} ${recruiter.lastName}`
    : session.email;
  const nextSubmissionId = `Sub-${String(count + 1).padStart(3, "0")}`;

  return (
    <SubmissionsView
      submissions={submissions}
      recruiterId={session.userId}
      recruiterName={recruiterName}
      nextSubmissionId={nextSubmissionId}
    />
  );
}
