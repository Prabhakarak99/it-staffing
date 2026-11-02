export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { VendorRequirementsView, type VendorSuggestion } from "./vendor-requirements-view";

// "Tata Consultancy Services, Inc." and "tata consultancy services inc" compare equal
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default async function VendorRequirementsPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Today's submissions that name an implementation partner
  const todaySubs = (await prisma.submission.findMany({
    where: { createdAt: { gte: todayStart }, implementationName: { not: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, consultantId: true, technology: true, jobDescription: true,
      vendorCompany: true, implementationName: true, clientName: true,
      consultant: { select: { firstName: true, lastName: true } },
      recruiter: { select: { firstName: true, lastName: true } },
    },
  })).filter((s) => norm(s.implementationName) !== "");

  // Full submission history with the same implementation partners
  const partners = new Set(todaySubs.map((s) => norm(s.implementationName)));
  const history = partners.size === 0 ? [] : (await prisma.submission.findMany({
    where: { implementationName: { not: null } },
    orderBy: { createdAt: "desc" },
    select: {
      consultantId: true, implementationName: true, vendorCompany: true,
      vendorRecruiterName: true, vendorRecruiterEmail: true, vendorRecruiterPhone: true,
      createdAt: true,
    },
  })).filter((h) => partners.has(norm(h.implementationName)));

  // partner → vendor → most recent contact + how many times we've submitted via that pair
  type VendorInfo = { company: string; name: string; email: string; phone: string; lastUsed: Date; count: number };
  const vendorsByPartner = new Map<string, Map<string, VendorInfo>>();
  // partner|consultant → vendors this consultant was already submitted to for that partner
  const usedByConsultant = new Map<string, Set<string>>();

  for (const h of history) {
    const p = norm(h.implementationName);
    const v = norm(h.vendorCompany);
    if (!v) continue;
    const vendors = vendorsByPartner.get(p) ?? new Map<string, VendorInfo>();
    const existing = vendors.get(v);
    if (existing) existing.count++; // history is newest-first, so the first contact seen is the latest
    else vendors.set(v, {
      company: h.vendorCompany.trim(), name: h.vendorRecruiterName, email: h.vendorRecruiterEmail,
      phone: h.vendorRecruiterPhone, lastUsed: h.createdAt, count: 1,
    });
    vendorsByPartner.set(p, vendors);

    const key = `${p}|${h.consultantId}`;
    usedByConsultant.set(key, (usedByConsultant.get(key) ?? new Set()).add(v));
  }

  // One row per (consultant, partner, other vendor), skipping vendors already used for that consultant
  const seen = new Set<string>();
  const suggestions: VendorSuggestion[] = [];
  for (const s of todaySubs) {
    const p = norm(s.implementationName);
    const used = usedByConsultant.get(`${p}|${s.consultantId}`) ?? new Set([norm(s.vendorCompany)]);
    const vendors = [...(vendorsByPartner.get(p)?.entries() ?? [])]
      .filter(([v]) => !used.has(v))
      .sort(([, a], [, b]) => b.count - a.count || b.lastUsed.getTime() - a.lastUsed.getTime());

    for (const [v, info] of vendors) {
      const key = `${s.consultantId}|${p}|${v}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        id: `${s.id}-${v}`,
        consultantName: `${s.consultant.firstName} ${s.consultant.lastName}`,
        recruiterName: `${s.recruiter.firstName} ${s.recruiter.lastName}`,
        technology: s.technology,
        jobDescription: s.jobDescription,
        implementationPartner: s.implementationName!.trim(),
        clientName: s.clientName,
        sourceVendor: s.vendorCompany,
        vendorCompany: info.company,
        vendorContactName: info.name,
        vendorContactEmail: info.email,
        vendorContactPhone: info.phone,
        pastSubmissions: info.count,
        lastUsed: info.lastUsed.toISOString(),
      });
    }
  }

  return (
    <VendorRequirementsView
      today={todayStart.toISOString()}
      suggestions={suggestions}
      sourceCount={todaySubs.length}
    />
  );
}
