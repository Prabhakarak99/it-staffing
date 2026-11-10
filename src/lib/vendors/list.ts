import { prisma } from "@/lib/prisma";
import { ownedWhere, type VendorAccess } from "./access";

/** Contacts visible to this user, JSON-ready (shared by the page's first render and the GET API) */
export async function listVendors(access: Extract<VendorAccess, { ok: true }>) {
  const rows = await prisma.recruiterVendor.findMany({
    where: ownedWhere(access),
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { firstName: true, lastName: true } } },
  });

  // A vendor without a typed-in JD shows the one from their latest requirement email (Vendor Requirements)
  const emails = [...new Set(rows.filter((r) => !r.jobDescription?.trim()).map((r) => r.email.toLowerCase()))];
  const fromEmail = new Map<string, { text: string; title: string | null; receivedAt: string }>();
  if (emails.length) {
    const reqs = await prisma.emailRequirement.findMany({
      where: { OR: [{ vendorEmail: { in: emails } }, { fromEmail: { in: emails } }] },
      orderBy: { receivedAt: "desc" },
      select: { vendorEmail: true, fromEmail: true, jobDescription: true, jobTitle: true, receivedAt: true },
      take: 2000,
    });
    for (const q of reqs) {
      for (const e of [q.vendorEmail, q.fromEmail]) {
        const key = e?.toLowerCase();
        if (key && emails.includes(key) && !fromEmail.has(key)) {
          fromEmail.set(key, { text: q.jobDescription, title: q.jobTitle, receivedAt: q.receivedAt.toISOString() });
        }
      }
    }
  }

  const weekAgo = Date.now() - 7 * 86_400_000;
  return {
    isAdmin: access.isAdmin,
    emailedLast7Days: rows.filter((r) => r.lastEmailedAt && r.lastEmailedAt.getTime() >= weekAgo).length,
    vendors: rows.map(({ owner, createdAt, updatedAt, lastEmailedAt, ...v }) => ({
      ...v,
      /** The JD to show and tailor resumes to: typed in, else from their latest requirement email */
      jd: v.jobDescription?.trim()
        ? { text: v.jobDescription.trim(), source: "manual" as const, title: null, receivedAt: null }
        : fromEmail.has(v.email.toLowerCase())
          ? { ...fromEmail.get(v.email.toLowerCase())!, source: "email" as const }
          : null,
      ownerName: `${owner.firstName} ${owner.lastName}`.trim(),
      lastEmailedAt: lastEmailedAt?.toISOString() ?? null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })),
  };
}

export type VendorList = Awaited<ReturnType<typeof listVendors>>;
