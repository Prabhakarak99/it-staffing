export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ConsultantsView } from "./consultants-view";

export default async function StudentsPage() {
  const [consultants, inMarketCount, onProjectCount] = await Promise.all([
    prisma.student.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        personalPhone: true,
        technology: true,
        visaStatus: true,
        projectStatus: true,
        offerLetterType: true,
        workMode: true,
        city: true,
        state: true,
        createdAt: true,
      },
    }),
    prisma.student.count({ where: { projectStatus: "In Market" } }),
    prisma.student.count({ where: { projectStatus: "On Project" } }),
  ]);

  return (
    <ConsultantsView
      consultants={consultants.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      inMarketCount={inMarketCount}
      onProjectCount={onProjectCount}
    />
  );
}
