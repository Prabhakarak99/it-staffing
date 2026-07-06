export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PreMarketingView } from "./premarketing-view";
import { checklistProgress, emptyChecklist, normalizeChecklist } from "@/lib/premarketing-checklist";

export default async function PreMarketingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const consultants = await prisma.student.findMany({
    where: { projectStatus: "Pre-Marketing" },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: {
      preMarketings: {
        include: {
          recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  const records = consultants.map((consultant) => {
    const record = consultant.preMarketings[0] ?? null;
    const checklist = record ? normalizeChecklist(record.checklist) : emptyChecklist();
    return {
      consultant: {
        id: consultant.id,
        firstName: consultant.firstName,
        lastName: consultant.lastName,
        email: consultant.email,
        technology: consultant.technology,
        originalVisaStatus: consultant.visaStatus,
        projectStatus: consultant.projectStatus,
      },
      consultantComment: "",
      record: record
        ? {
            id: record.id,
            checklist,
            marketingVisaStatus: record.marketingVisaStatus,
            marketingStartDate: record.marketingStartDate?.toISOString() ?? null,
            marketingEndDate: record.marketingEndDate?.toISOString() ?? null,
            recruiter: record.recruiter,
            updatedAt: record.updatedAt.toISOString(),
          }
        : null,
      progress: checklistProgress(checklist),
    };
  });

  return <PreMarketingView records={records} />;
}
