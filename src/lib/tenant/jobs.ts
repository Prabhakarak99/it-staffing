import { unscopedPrisma } from "@/lib/prisma";
import { runAs } from "./context";

/**
 * Runs a background job once for every active company, each inside that company's scope, one after
 * another. One company's failure is logged and does not stop the others.
 * `includePlatform`: also run for the platform company (the shared job pool).
 */
export async function forEachCompany(label: string, job: () => Promise<unknown>, { includePlatform = false } = {}) {
  const companies = await unscopedPrisma.company.findMany({
    where: { status: "active", ...(includePlatform ? {} : { kind: "company" }) },
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
  });
  for (const c of companies) {
    try {
      await runAs(c.id, job);
    } catch (err) {
      console.error(`[${label}] ${c.slug}:`, err);
    }
  }
}

/** Runs a one-time job (from before companies existed) inside GenFusion Tech, the original company */
export async function asOriginalCompany(job: () => Promise<unknown>) {
  const c = await unscopedPrisma.company.findUnique({ where: { slug: "genfusiontech" }, select: { id: true } });
  if (c) await runAs(c.id, job);
}
