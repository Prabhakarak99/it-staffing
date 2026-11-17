export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canSeeAllLeads, leadScope } from "@/lib/leads/access";
import { leadStatusFromConsultant } from "@/lib/leads/fields";
import { LeadsView } from "./leads-view";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ sheet?: string; message?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const seeAll = canSeeAllLeads(session);
  const leads = await prisma.lead.findMany({
    where: leadScope(session),
    include: { createdBy: { select: { firstName: true, lastName: true } }, consultant: { select: { projectStatus: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Converted leads: keep their status in step with the consultant's progress
  const stale = leads.flatMap((l) => {
    const next = leadStatusFromConsultant(l.consultant?.projectStatus);
    return next && next !== l.status ? [{ id: l.id, next }] : [];
  });
  for (const s of stale) {
    await prisma.lead.update({ where: { id: s.id }, data: { status: s.next } });
    const lead = leads.find((l) => l.id === s.id);
    if (lead) lead.status = s.next;
  }

  return (
    <LeadsView
      showOwner={seeAll}
      myEmail={session.email}
      sheetNotice={sp.sheet === "connected" ? { ok: true } : sp.sheet === "enabled" ? { ok: true, enabledOnly: true } : sp.sheet === "error" ? { ok: false, message: sp.message ?? "Could not connect Google Sheets." } : null}
      leads={leads.map(({ createdBy, consultant, ...lead }) => ({
        ...lead,
        consultantStatus: consultant?.projectStatus ?? null,
        createdByName: createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : null,
        optStartDate: lead.optStartDate?.toISOString() ?? null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }))}
    />
  );
}
