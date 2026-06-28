export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { RecruitersView } from "./recruiters-view";

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

  return <RecruitersView recruiters={recruiters} roles={roles} />;
}
