import { prisma } from "@/lib/prisma";
import { submissionForSend } from "./matches";

const MIGRATION_ID = "requirement-sends-to-submissions";

/**
 * One time: resumes sent from Vendor Requirements before sends became Submissions get their Submission
 * now, dated when they were sent (skipped where that consultant was already submitted to that vendor).
 */
export async function backfillRequirementSubmissionsOnce() {
  if (await prisma.appMigration.findUnique({ where: { id: MIGRATION_ID } })) return;
  const sends = await prisma.emailRequirementSend.findMany({
    where: { status: "sent" },
    orderBy: { createdAt: "asc" },
    include: { requirement: true, consultant: { select: { technology: true } } },
  });
  let created = 0;
  for (const s of sends) {
    try {
      const made = await submissionForSend({
        req: s.requirement,
        consultantId: s.consultantId,
        consultantTechnology: s.consultant.technology,
        recruiterId: s.senderId,
        to: s.toEmail,
        at: s.createdAt,
      });
      if (made) created++;
    } catch (err) {
      console.error(`[requirements] backfill send ${s.id}:`, err instanceof Error ? err.message : err);
    }
  }
  await prisma.appMigration.create({ data: { id: MIGRATION_ID } });
  console.log(`[requirements] backfill: ${created} submission(s) created from ${sends.length} earlier resume send(s)`);
}
