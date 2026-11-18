import { nextSubmissionId as peekNextSubmissionId } from "@/lib/submissions/record";
export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SubmissionForm } from "./submission-form";

export default async function CreateSubmissionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [recruiter] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    }),
  ]);

  const nextSubmissionId = await peekNextSubmissionId();
  const recruiterName = recruiter
    ? `${recruiter.firstName} ${recruiter.lastName}`
    : session.email;

  return (
    <>
      <Header title="Create Submission" />
      <div className="p-6">
        <SubmissionForm
          recruiterId={session.userId}
          recruiterName={recruiterName}
          nextSubmissionId={nextSubmissionId}
        />
      </div>
    </>
  );
}
