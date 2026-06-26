export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { OnboardRecruiterForm } from "./onboard-recruiter-form";
import { RecruiterList } from "./recruiter-list";

export default async function RecruitersPage() {
  const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });

  const [recruiters, roles] = await Promise.all([
    prisma.user.findMany({
      where: recruiterRole ? { roleId: recruiterRole.id } : {},
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <Header title="Onboard Recruiter" />
      <div className="p-6 space-y-6">
        <OnboardRecruiterForm roles={roles} />
        <RecruiterList recruiters={recruiters} roles={roles} />
      </div>
    </>
  );
}
