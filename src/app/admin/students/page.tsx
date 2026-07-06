export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ConsultantsView } from "./consultants-view";

export default async function StudentsPage() {
  const [consultants, inMarketCount, onProjectCount, preMarketingCount] = await Promise.all([
    prisma.student.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        personalPhone: true,
        onboardingStartDate: true,
        technology: true,
        visaStatus: true,
        projectStatus: true,
        offerLetterType: true,
        workMode: true,
        driveLocation: true,
        comments: true,
        createdAt: true,
        preMarketings: {
          select: { marketingStartDate: true, marketingVisaStatus: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.student.count({ where: { projectStatus: "In-Market" } }),
    prisma.student.count({ where: { projectStatus: "In-Project" } }),
    prisma.student.count({ where: { projectStatus: "Pre-Marketing" } }),
  ]);

  return (
    <ConsultantsView
      consultants={consultants.map(({ preMarketings, comments, ...c }) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        onboardingStartDate: c.onboardingStartDate?.toISOString() ?? null,
        comments: Array.isArray(comments) ? comments : [],
        marketingStartDate: preMarketings[0]?.marketingStartDate?.toISOString() ?? null,
        marketingVisaStatus: preMarketings[0]?.marketingVisaStatus ?? null,
      }))}
      inMarketCount={inMarketCount}
      onProjectCount={onProjectCount}
      preMarketingCount={preMarketingCount}
    />
  );
}
