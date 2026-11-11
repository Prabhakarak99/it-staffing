import { prisma } from "@/lib/prisma";
import { MARKETING_STATUSES, onTechnology, techStem } from "@/lib/easy/data";
import type { Audience } from "./constants";

export interface MarketedConsultant {
  name: string;
  technology: string;
  recruiterId: string;
}

/** Every In-Market consultant with a technology and an assigned recruiter */
export async function marketedConsultants(): Promise<MarketedConsultant[]> {
  const rows = await prisma.student.findMany({
    where: { projectStatus: { in: MARKETING_STATUSES }, technology: { not: null }, preMarketings: { some: { recruiterId: { not: null } } } },
    select: { firstName: true, lastName: true, technology: true, preMarketings: { select: { recruiterId: true }, orderBy: { updatedAt: "desc" }, take: 1 } },
  });
  return rows
    .filter((r) => r.technology?.trim() && r.preMarketings[0]?.recruiterId)
    .map((r) => ({ name: `${r.firstName} ${r.lastName}`.trim(), technology: r.technology!.trim(), recruiterId: r.preMarketings[0].recruiterId! }));
}

/** Consultants on the requirement's technology */
export function consultantsOn(technology: string | null, consultants: MarketedConsultant[]) {
  const tech = technology?.trim();
  if (!tech || tech.toLowerCase() === "others") return [];
  const stem = techStem(tech);
  return consultants.filter((c) => c.technology.toLowerCase() === tech.toLowerCase() || onTechnology(c.technology, stem));
}

/**
 * Who sees a requirement, worked out from today's consultant assignments (so it follows reassignments):
 * every recruiter with an In-Market consultant on its technology, whichever inbox it arrived in. A
 * recruiter without one never sees it, even from their own inbox. Nobody on that technology: managers only.
 */
export function audienceFor(technology: string | null, consultants: MarketedConsultant[]): Audience {
  const working = new Set(consultantsOn(technology, consultants).map((c) => c.recruiterId));
  return working.size ? { kind: "shared", userIds: [...working] } : { kind: "unassigned" };
}

export const canSee = (audience: Audience, userId: string) => audience.kind !== "unassigned" && audience.userIds.includes(userId);
