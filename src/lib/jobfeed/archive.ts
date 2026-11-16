import { prisma } from "@/lib/prisma";
import { dayStart } from "@/lib/tz";

/**
 * One-time soft delete asked for on 2026-11-16: every Requirements job collected before that day
 * (Central) is archived. Archived jobs stay in the table as a backup but are never listed again,
 * even if a source reports the same job later. Nothing is deleted.
 */
export async function archiveOldJobsOnce() {
  const id = "archive-requirement-jobs-before-2026-11-16";
  if (await prisma.appMigration.findUnique({ where: { id } })) return;
  const [res] = await prisma.$transaction([
    prisma.jobSearchResult.updateMany({ where: { archivedAt: null, dateScraped: { lt: dayStart("2026-11-16") } }, data: { archivedAt: new Date() } }),
    prisma.appMigration.create({ data: { id } }),
  ]);
  console.log(`[jobfeed] archived ${res.count} requirement job(s) collected before 2026-11-16 (kept as backup)`);
}
