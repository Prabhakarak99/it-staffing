export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InterviewList } from "../interview-list";

export default async function TotalInterviewsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const interviews = await prisma.interview.findMany({
    include: {
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
  });

  return (
    <>
      <Header title="Total Interviews" />
      <div className="p-6">
        <InterviewList interviews={interviews} />
      </div>
    </>
  );
}
