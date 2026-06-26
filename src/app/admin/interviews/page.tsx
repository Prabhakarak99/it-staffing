export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InterviewForm } from "./interview-form";

export default async function CreateInterviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [recruiter, count, mySubmissions] = await Promise.all([
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
    <>
      <Header title="Create Interview" />
      <div className="p-6">
        <InterviewForm
          recruiterId={session.userId}
          recruiterName={recruiterName}
          nextInterviewId={nextInterviewId}
          mySubmissions={mySubmissions}
        />
      </div>
    </>
  );
}
