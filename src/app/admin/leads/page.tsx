export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canSeeAllLeads, leadScope } from "@/lib/leads/access";
import { LeadsView } from "./leads-view";

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const seeAll = canSeeAllLeads(session);
  const leads = await prisma.lead.findMany({
    where: leadScope(session),
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <LeadsView
      showOwner={seeAll}
      leads={leads.map(({ createdBy, ...lead }) => ({
        ...lead,
        createdByName: createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : null,
        optStartDate: lead.optStartDate?.toISOString() ?? null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }))}
    />
  );
}
