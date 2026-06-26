import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SubmissionForm } from "./submission-form";
import { SubmissionList } from "./submission-list";

export default async function SubmissionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [recruiter, count, submissions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    }),
    prisma.submission.count(),
    prisma.submission.findMany({
      include: {
        recruiter: { select: { firstName: true, lastName: true } },
        consultant: { select: { firstName: true, lastName: true, technology: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const nextSubmissionId = `Sub-${String(count + 1).padStart(3, "0")}`;
  const recruiterName = recruiter
    ? `${recruiter.firstName} ${recruiter.lastName}`
    : session.email;

  return (
    <>
      <Header title="Submissions" />
      <div className="p-6 space-y-6">
        <SubmissionForm
          recruiterId={session.userId}
          recruiterName={recruiterName}
          nextSubmissionId={nextSubmissionId}
        />
        <SubmissionList submissions={submissions} />
      </div>
    </>
  );
}
