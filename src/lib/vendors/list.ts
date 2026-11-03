import { prisma } from "@/lib/prisma";
import { ownedWhere, type VendorAccess } from "./access";

/** Contacts visible to this user, JSON-ready (shared by the page's first render and the GET API) */
export async function listVendors(access: Extract<VendorAccess, { ok: true }>) {
  const rows = await prisma.recruiterVendor.findMany({
    where: ownedWhere(access),
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { firstName: true, lastName: true } } },
  });

  const weekAgo = Date.now() - 7 * 86_400_000;
  return {
    isAdmin: access.isAdmin,
    emailedLast7Days: rows.filter((r) => r.lastEmailedAt && r.lastEmailedAt.getTime() >= weekAgo).length,
    vendors: rows.map(({ owner, createdAt, updatedAt, lastEmailedAt, ...v }) => ({
      ...v,
      ownerName: `${owner.firstName} ${owner.lastName}`.trim(),
      lastEmailedAt: lastEmailedAt?.toISOString() ?? null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })),
  };
}

export type VendorList = Awaited<ReturnType<typeof listVendors>>;
