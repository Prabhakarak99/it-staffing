import { prisma } from "@/lib/prisma";
import { countMessages } from "./api";
import { GmailNotConnectedError, isGmailConfigured } from "./oauth";

/** Re-count an account at most this often from the background worker */
const SYNC_EVERY_MS = 15 * 60_000;

/** Same boundaries as the recruiter dashboard: server-local day, Monday-based week, calendar month */
export function periodStarts(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = now.getDay();
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dow === 0 ? 6 : dow - 1));
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  return { today, week, month, earliest: week < month ? week : month };
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const epoch = (d: Date) => Math.floor(d.getTime() / 1000);

/**
 * Count one user's received and sent mail per day. The first sync backfills the current week and
 * month; later syncs re-count yesterday and today (late-arriving mail, deletes).
 */
export async function syncEmailStats(userId: string) {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account) return;

  const { today, earliest } = periodStarts();
  const from = account.lastSyncAt ? addDays(today, -1) : earliest;

  try {
    for (let day = from; day <= today; day = addDays(day, 1)) {
      const range = `after:${epoch(day)} before:${epoch(addDays(day, 1))}`;
      const [received, sent] = await Promise.all([
        countMessages(userId, `${range} -in:sent -in:drafts -in:chats`),
        countMessages(userId, `${range} in:sent`),
      ]);
      await prisma.emailDailyStat.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, received, sent },
        update: { received, sent },
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

/** Worker tick: re-count every connected mailbox that is due, one at a time. */
export async function processEmailStats() {
  if (running || !(await isGmailConfigured())) return;
  running = true;
  try {
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

/** Today / this week / this month totals per user */
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
