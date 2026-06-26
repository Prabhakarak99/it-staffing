export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SubmissionList } from "../submission-list";

export default async function TotalSubmissionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Recruiters see only their own submissions; super admin and other roles see all
  const isRecruiter = session.roleName === "Recruiter";

  const submissions = await prisma.submission.findMany({
    where: isRecruiter ? { recruiterId: session.userId } : {},
    include: {
      recruiter: { select: { firstName: true, lastName: true } },
      consultant: { select: { firstName: true, lastName: true, technology: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Header title="Total Submissions" />
      <div className="p-6">
        <SubmissionList submissions={submissions} />
      </div>
    </>
  );
}
