import { prisma } from "@/lib/prisma";
import { countMessages } from "./api";
import { GmailNotConnectedError, isGmailConfigured } from "./oauth";
import { addKeyDays, centralPeriods, dayKeyOf, dayStart } from "@/lib/tz";

/** Re-count an account at most this often from the background worker */
const SYNC_EVERY_MS = 15 * 60_000;

/** Same boundaries as the recruiter dashboard: Central day, Monday-based week, calendar month */
export const periodStarts = centralPeriods;

const epoch = (d: Date) => Math.floor(d.getTime() / 1000);

/**
 * Count one user's Inbox and Sent mail per day into EmailDailyStat. Only message ids are listed,
 * never the emails themselves. The first sync backfills the current week and month; later syncs
 * re-count yesterday and today.
 */
export async function syncEmailStats(userId: string) {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return;

  // Each row's `day` is midnight Central at the start of that day
  const { todayKey, earliestKey } = periodStarts();
  const fromKey = account.lastSyncAt ? addKeyDays(todayKey, -1) : earliestKey;

  try {
    for (let key = fromKey; key <= todayKey; key = addKeyDays(key, 1)) {
      const day = dayStart(key);
      const range = `after:${epoch(day)} before:${epoch(dayStart(addKeyDays(key, 1)))}`;
      const [received, sent] = await Promise.all([
        countMessages(userId, `${range} in:inbox`),
        countMessages(userId, `${range} in:sent`),
      ]);
      await prisma.emailDailyStat.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, email: account.email, day, received, sent },
        update: { email: account.email, received, sent },
      });
    }
    await prisma.gmailAccount.update({ where: { userId }, data: { lastSyncAt: new Date(), lastError: null } });
  } catch (err) {
    // A token problem is already recorded by getAccessToken
    if (!(err instanceof GmailNotConnectedError)) {
      await prisma.gmailAccount.update({
        where: { userId },
        data: { lastError: (err instanceof Error ? err.message : String(err)).slice(0, 300) },
      });
    }
    throw err;
  }
}

let running = false;

/** "Received" used to mean all mail except Sent; it now means the Inbox. Re-count the month once. */
async function recountOnce() {
  const id = "gmail-stats-inbox-count";
  if (await prisma.appMigration.findUnique({ where: { id } })) return;
  await prisma.$transaction([
    prisma.gmailAccount.updateMany({ data: { lastSyncAt: null } }),
    prisma.appMigration.create({ data: { id } }),
  ]);
}

/** Worker tick: re-count every connected mailbox that is due, one at a time. */
export async function processEmailStats() {
  if (running || !(await isGmailConfigured())) return;
  running = true;
  try {
    await recountOnce();
    const due = await prisma.gmailAccount.findMany({
      where: { OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - SYNC_EVERY_MS) } }] },
      select: { userId: true },
    });
    for (const { userId } of due) {
      try {
        await syncEmailStats(userId);
      } catch (err) {
        console.error(`[gmail-stats] ${userId}:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    running = false;
  }
}

export interface EmailCounts {
  received: { today: number; week: number; month: number };
  sent: { today: number; week: number; month: number };
}

export const emptyCounts = (): EmailCounts => ({
  received: { today: 0, week: 0, month: 0 },
  sent: { today: 0, week: 0, month: 0 },
});

export interface DailyRow {
  /** yyyy-mm-dd */
  day: string;
  userId: string;
  name: string;
  email: string;
  received: number;
  sent: number;
}

/** This month's daily rows, newest first */
export async function getDailyRows(userIds: string[]): Promise<DailyRow[]> {
  const { earliest } = periodStarts();
  const rows = await prisma.emailDailyStat.findMany({
    where: { userId: { in: userIds }, day: { gte: earliest } },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: [{ day: "desc" }, { sent: "desc" }],
  });
  return rows.map((r) => ({
    day: dayKeyOf(r.day),
    userId: r.userId,
    name: `${r.user.firstName} ${r.user.lastName}`.trim(),
    email: r.email,
    received: r.received,
    sent: r.sent,
  }));
}

/** Today / this week / this month totals per user, added up from the daily rows */
export async function getEmailCounts(userIds: string[]) {
  const { today, week, month, earliest } = periodStarts();
  const rows = await prisma.emailDailyStat.findMany({
    where: { userId: { in: userIds }, day: { gte: earliest } },
  });

  const counts = new Map<string, EmailCounts>(userIds.map((id) => [id, emptyCounts()]));
  for (const r of rows) {
    const c = counts.get(r.userId)!;
    if (r.day >= today) { c.received.today += r.received; c.sent.today += r.sent; }
    if (r.day >= week)  { c.received.week += r.received;  c.sent.week += r.sent; }
    if (r.day >= month) { c.received.month += r.received; c.sent.month += r.sent; }
  }
  return counts;
}
