import { prisma } from "@/lib/prisma";
import { leadKey, type ParsedLead, type SkippedRow } from "./import";

/** Adds parsed sheet rows as this user's leads, skipping the ones they already have */
export async function saveImportedLeads(userId: string, parsed: { leads: { row: number; lead: ParsedLead }[]; skipped: SkippedRow[] }) {
  const mine = await prisma.lead.findMany({ where: { createdById: userId }, select: { consultantName: true, email: true, phoneNumber: true } });
  const seen = new Set(mine.map(leadKey).filter(Boolean));
  const skipped: SkippedRow[] = [...parsed.skipped];
  const data = [];
  for (const { row, lead } of parsed.leads) {
    const key = leadKey(lead);
    if (key && seen.has(key)) {
      skipped.push({ row, reason: `Already in your leads${lead.email ? ` (${lead.email})` : lead.consultantName ? ` (${lead.consultantName})` : ""}` });
      continue;
    }
    if (key) seen.add(key);
    data.push({ ...lead, createdById: userId });
  }
  if (data.length) await prisma.lead.createMany({ data });
  skipped.sort((a, b) => a.row - b.row);
  return { added: data.length, skipped };
}
