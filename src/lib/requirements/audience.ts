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
    select: { firstName: true, lastName: true, technology: true, preMarketings: { select: { recruiterId: true }, take: 1 } },
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
 * Who sees a requirement, worked out from today's consultant assignments (so it follows reassignments).
 * A recruiter only ever sees requirements on a technology they have an In-Market consultant on:
 * 1. A recruiter who received the email and has a consultant on the technology keeps it to themselves.
 * 2. Otherwise it goes to every recruiter who works a consultant on the technology.
 * 3. Nobody works that technology: only managers see it.
 */
export function audienceFor(technology: string | null, receivers: string[], consultants: MarketedConsultant[]): Audience {
  const onTech = consultantsOn(technology, consultants);
  const working = new Set(onTech.map((c) => c.recruiterId));
  const owning = receivers.filter((id) => working.has(id));
  if (owning.length) return { kind: "private", userIds: owning };
  if (working.size) return { kind: "shared", userIds: [...working] };
  return { kind: "unassigned" };
}

export const canSee = (audience: Audience, userId: string) => audience.kind !== "unassigned" && audience.userIds.includes(userId);
