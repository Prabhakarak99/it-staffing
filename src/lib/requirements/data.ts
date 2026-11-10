import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/roles";
import type { SessionPayload } from "@/lib/auth";
import { audienceFor, canSee, consultantsOn, marketedConsultants } from "./audience";
import type { RequirementRow } from "./constants";

/** How far back the tab looks */
export const LIST_DAYS = 30;
const MAX_ROWS = 3000;

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

/**
 * Requirements this user may see, newest first. Managers see everything; everyone else sees what the
 * distribution rules give them (src/lib/requirements/audience.ts). `createdAfter` is for the notifier.
 */
export async function listRequirements(
  session: Pick<SessionPayload, "userId" | "allowedScreens" | "roleName">,
  opts: { createdAfter?: Date; days?: number; limit?: number } = {},
): Promise<RequirementRow[]> {
  const manager = isManager(session);
  const since = new Date(Date.now() - (opts.days ?? LIST_DAYS) * 86_400_000);
  const [rows, consultants, users] = await Promise.all([
    prisma.emailRequirement.findMany({
      where: { receivedAt: { gte: since }, ...(opts.createdAfter ? { createdAt: { gt: opts.createdAfter } } : {}) },
      orderBy: { receivedAt: "desc" },
      take: MAX_ROWS,
      include: { owner: { select: { id: true, firstName: true, lastName: true, gmailAccount: { select: { email: true } } } } },
    }),
    marketedConsultants(),
    prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, fullName(u)]));

  const out: RequirementRow[] = [];
  for (const r of rows) {
    const receivers = [r.ownerId, ...r.alsoReceivedBy];
    const audience = audienceFor(r.technology, receivers, consultants);
    if (!manager && !canSee(audience, session.userId)) continue;
    out.push({
      id: r.id,
      receivedAt: r.receivedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      subject: r.subject,
      jobTitle: r.jobTitle,
      technology: r.technology,
      clientName: r.clientName,
      location: r.location,
      workMode: r.workMode,
      employmentType: r.employmentType,
      rate: r.rate,
      duration: r.duration,
      visa: r.visa,
      jobDescription: r.jobDescription,
      vendorName: r.vendorName,
      vendorCompany: r.vendorCompany,
      vendorEmail: r.vendorEmail,
      vendorPhone: r.vendorPhone,
      fromEmail: r.fromEmail,
      source: { id: r.owner.id, name: fullName(r.owner), email: r.owner.gmailAccount?.email ?? null },
      alsoReceivedBy: r.alsoReceivedBy.map((id) => nameOf.get(id) ?? "").filter(Boolean),
      audience: { kind: audience.kind, names: audience.kind === "everyone" ? [] : audience.userIds.map((id) => nameOf.get(id) ?? "").filter(Boolean) },
      myConsultants: consultantsOn(r.technology, consultants).filter((c) => c.recruiterId === session.userId).map((c) => c.name),
      mine: receivers.includes(session.userId),
    });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}
