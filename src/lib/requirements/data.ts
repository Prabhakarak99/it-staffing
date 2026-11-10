import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/roles";
import type { SessionPayload } from "@/lib/auth";
import { audienceFor, canSee, consultantsOn, marketedConsultants } from "./audience";
import { onTechnology, techStem } from "@/lib/easy/data";
import type { RequirementRow } from "./constants";

/** How far back the tab looks */
export const LIST_DAYS = 30;
const MAX_ROWS = 3000;

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

const FULL_TIME = /full[\s-]?time|\bfte\b|permanent|direct[\s-]?hire/i;
const CONTRACT = /\bc2c\b|corp[\s-]?to[\s-]?corp|\bw-?2\b|\b1099\b|contract|\bc2h\b|\btemp/i;

/** Full-time-only positions aren't shown (we place contractors); "C2C / Full-time" still is. Kept in the DB. */
export function isFullTimeOnly(r: { employmentType: string | null; jobTitle: string | null }) {
  const text = [r.employmentType, r.jobTitle].filter(Boolean).join(" ");
  return FULL_TIME.test(text) && !CONTRACT.test(text);
}

/**
 * Requirements this user may see, newest first. Managers see everything, with where each came from;
 * recruiters see only requirements on their consultants' technologies (src/lib/requirements/audience.ts)
 * and never which inbox they came from, and not the ones they've already done (see `doneBy`).
 * `createdAfter` is for the notifier.
 */
export async function listRequirements(
  session: Pick<SessionPayload, "userId" | "allowedScreens" | "roleName">,
  opts: { createdAfter?: Date; days?: number; limit?: number } = {},
): Promise<RequirementRow[]> {
  const manager = isManager(session);
  const since = new Date(Date.now() - (opts.days ?? LIST_DAYS) * 86_400_000);
  const [rows, consultants, users, boxes, done] = await Promise.all([
    prisma.emailRequirement.findMany({
      where: { receivedAt: { gte: since }, ...(opts.createdAfter ? { createdAt: { gt: opts.createdAfter } } : {}) },
      orderBy: { receivedAt: "desc" },
      take: MAX_ROWS,
      include: { owner: { select: { id: true, firstName: true, lastName: true, gmailAccount: { select: { email: true } } } } },
    }),
    marketedConsultants(),
    prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } }),
    prisma.consultantMailbox.findMany({ select: { consultantId: true, email: true, consultant: { select: { firstName: true, lastName: true } } } }),
    manager ? null : doneBy(session.userId, since),
  ]);
  const boxOf = new Map(boxes.map((b) => [b.consultantId, { email: b.email, name: fullName(b.consultant) }]));
  const nameOf = new Map(users.map((u) => [u.id, fullName(u)]));

  const out: RequirementRow[] = [];
  for (const r of rows) {
    if (isFullTimeOnly(r)) continue;
    if (done?.(r)) continue;
    const receivers = [r.ownerId, ...r.alsoReceivedBy];
    const audience = audienceFor(r.technology, consultants);
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
      // Where it came from and who else has it: managers only
      source: !manager
        ? null
        : r.consultantId
          ? { id: r.owner.id, name: fullName(r.owner), email: boxOf.get(r.consultantId)?.email ?? null, consultant: boxOf.get(r.consultantId)?.name ?? "Consultant" }
          : { id: r.owner.id, name: fullName(r.owner), email: r.owner.gmailAccount?.email ?? null, consultant: null },
      alsoReceivedBy: manager ? r.alsoReceivedBy.map((id) => nameOf.get(id) ?? "").filter(Boolean) : [],
      audience: {
        kind: audience.kind,
        names: manager && audience.kind !== "unassigned" ? audience.userIds.map((id) => nameOf.get(id) ?? "").filter(Boolean) : [],
      },
      myConsultants: consultantsOn(r.technology, consultants).filter((c) => c.recruiterId === session.userId).map((c) => c.name),
      mine: manager && receivers.includes(session.userId),
    });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

/**
 * Requirements a recruiter has already worked: they sent a resume for it from Vendor Requirements, or
 * they logged a submission to the same vendor on the same technology after it arrived (a day's slack).
 */
async function doneBy(userId: string, since: Date) {
  const [sent, subs] = await Promise.all([
    prisma.emailRequirementSend.findMany({ where: { senderId: userId, status: "sent" }, select: { requirementId: true } }),
    prisma.submission.findMany({
      where: { recruiterId: userId, submissionDate: { gte: new Date(since.getTime() - 86_400_000) } },
      select: { vendorRecruiterEmail: true, technology: true, submissionDate: true },
    }),
  ]);
  const sentIds = new Set(sent.map((s) => s.requirementId));
  const byVendor = new Map<string, { technology: string; at: number }[]>();
  for (const s of subs) {
    const key = s.vendorRecruiterEmail.trim().toLowerCase();
    byVendor.set(key, [...(byVendor.get(key) ?? []), { technology: s.technology, at: s.submissionDate.getTime() }]);
  }
  return (r: { id: string; vendorEmail: string | null; fromEmail: string; technology: string | null; receivedAt: Date }) => {
    if (sentIds.has(r.id)) return true;
    const stem = r.technology && r.technology !== "Others" ? techStem(r.technology) : null;
    const after = r.receivedAt.getTime() - 86_400_000;
    return [r.vendorEmail, r.fromEmail].some((e) =>
      !!e && (byVendor.get(e.trim().toLowerCase()) ?? []).some((s) => s.at >= after && (!stem || onTechnology(s.technology, stem) || s.technology.toLowerCase() === r.technology!.toLowerCase())),
    );
  };
}
