import { prisma } from "@/lib/prisma";
import { addKeyDays, dayKeyOf, dayStart } from "@/lib/tz";
import { REQ_TECHNOLOGIES } from "./constants";
import { ourCompany } from "./internal";

export interface RequirementReport {
  /** "yyyy-mm-dd" Central, oldest first */
  days: string[];
  rows: { technology: string; received: number[]; sent: number[]; totalReceived: number; totalSent: number }[];
  totals: { received: number[]; sent: number[]; totalReceived: number; totalSent: number };
  /** Requirements received in the range that had at least one resume sent */
  answered: number;
}

/**
 * Vendor requirement emails received per day and technology (every one the inbox reader stored, except
 * our own company's mail), and the resumes sent for them from Vendor Requirements, by the day sent.
 */
export async function requirementReport(fromKey: string, toKey: string): Promise<RequirementReport> {
  const days: string[] = [];
  for (let k = fromKey; k <= toKey; k = addKeyDays(k, 1)) days.push(k);
  const range = { gte: dayStart(fromKey), lt: dayStart(addKeyDays(toKey, 1)) };

  const [reqs, sends, us] = await Promise.all([
    prisma.emailRequirement.findMany({
      where: { receivedAt: range },
      select: { id: true, technology: true, receivedAt: true, fromEmail: true, vendorEmail: true, vendorCompany: true },
    }),
    prisma.emailRequirementSend.findMany({
      where: { status: "sent", createdAt: range },
      select: { requirementId: true, createdAt: true, requirement: { select: { technology: true } } },
    }),
    ourCompany(),
  ]);

  const known = new Map(REQ_TECHNOLOGIES.map((t) => [t.toLowerCase(), t]));
  const techOf = (t: string | null) => known.get((t ?? "").trim().toLowerCase()) ?? "Others";
  const index = new Map(days.map((d, i) => [d, i]));
  const zero = () => days.map(() => 0);
  const byTech = new Map<string, { received: number[]; sent: number[] }>();
  const cell = (tech: string) => {
    let c = byTech.get(tech);
    if (!c) byTech.set(tech, (c = { received: zero(), sent: zero() }));
    return c;
  };

  const counted = new Set<string>();
  for (const r of reqs) {
    if (us.isOurs(r.fromEmail) || us.isOurs(r.vendorEmail, r.vendorCompany)) continue;
    const i = index.get(dayKeyOf(r.receivedAt));
    if (i === undefined) continue;
    cell(techOf(r.technology)).received[i]++;
    counted.add(r.id);
  }
  const answered = new Set<string>();
  for (const s of sends) {
    const i = index.get(dayKeyOf(s.createdAt));
    if (i === undefined) continue;
    cell(techOf(s.requirement.technology)).sent[i]++;
    if (counted.has(s.requirementId)) answered.add(s.requirementId);
  }

  const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);
  const rows = [...byTech.entries()]
    .map(([technology, c]) => ({ technology, ...c, totalReceived: sum(c.received), totalSent: sum(c.sent) }))
    .sort((a, b) => b.totalReceived - a.totalReceived || a.technology.localeCompare(b.technology));
  const totals = {
    received: days.map((_, i) => rows.reduce((n, r) => n + r.received[i], 0)),
    sent: days.map((_, i) => rows.reduce((n, r) => n + r.sent[i], 0)),
    totalReceived: rows.reduce((n, r) => n + r.totalReceived, 0),
    totalSent: rows.reduce((n, r) => n + r.totalSent, 0),
  };
  return { days, rows, totals, answered: answered.size };
}
