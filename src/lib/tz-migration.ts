import { prisma } from "@/lib/prisma";
import { APP_TZ } from "@/lib/tz";

const MIGRATION_ID = "central-time-zone";

/**
 * One-time move from the old clocks (server UTC, India attendance days) to US Central:
 * - Interview times were typed as wall-clock times and saved as if they were UTC. Keep the same
 *   wall-clock time, now meaning Central (10:00 stays 10:00).
 * - Email counts were per UTC day: clear them and re-count this week and month on Central days.
 * - Attendance marked after midnight India time but still the same Central day was saved on the next
 *   date: move such future-dated marks back to the Central day they were made.
 */
export async function migrateToCentralOnce() {
  if (await prisma.appMigration.findUnique({ where: { id: MIGRATION_ID } })) return;
  const tz = APP_TZ;
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "Interview" SET
      "interviewStartDate" = ("interviewStartDate" AT TIME ZONE ${tz}) AT TIME ZONE 'UTC',
      "interviewEndDate"   = ("interviewEndDate"   AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`,
    // Only this week and month are ever shown, and both are re-counted below
    prisma.emailDailyStat.deleteMany({}),
    prisma.$executeRaw`UPDATE "Attendance" a SET "day" = (("markedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date
      WHERE a."day" > (now() AT TIME ZONE ${tz})::date
        AND NOT EXISTS (
          SELECT 1 FROM "Attendance" b
          WHERE b."userId" = a."userId" AND b."day" = ((a."markedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date
        )`,
    // Left over only when that Central day already had a mark: a duplicate of it, not a real future day
    prisma.$executeRaw`DELETE FROM "Attendance" WHERE "day" > (now() AT TIME ZONE ${tz})::date AND "reviewedById" IS NULL`,
    prisma.gmailAccount.updateMany({ data: { lastSyncAt: null } }),
    prisma.appMigration.create({ data: { id: MIGRATION_ID } }),
  ]);
  console.log("[tz] moved interviews, email counts and attendance to US Central time");
}
