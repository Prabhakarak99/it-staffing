import { prisma } from "@/lib/prisma";
import { emptyCounts, getDailyRows, getEmailCounts, type DailyRow, type EmailCounts } from "./stats";

export interface AccountStatus {
  email: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface TeamRow {
  userId: string;
  name: string;
  roleName: string | null;
  account: AccountStatus | null;
  counts: EmailCounts;
}

export interface EmailActivity {
  account: AccountStatus | null;
  counts: EmailCounts;
  /** Admins only: every recruiter plus anyone else who connected Gmail */
  team: TeamRow[] | null;
  /** This month's per-day counts: the user's own, or everyone's for admins */
  daily: DailyRow[];
}

const toStatus = (a: { email: string; connectedAt: Date; lastSyncAt: Date | null; lastError: string | null } | null) =>
  a
    ? {
        email: a.email,
        connectedAt: a.connectedAt.toISOString(),
        lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
        lastError: a.lastError,
      }
    : null;

/** Used by the Mailbox page, the stats API and the recruiter dashboard. Never exposes tokens. */
export async function getEmailActivity(userId: string, isAdmin: boolean): Promise<EmailActivity> {
  const accountSelect = { email: true, connectedAt: true, lastSyncAt: true, lastError: true } as const;

  if (!isAdmin) {
    const [account, counts, daily] = await Promise.all([
      prisma.gmailAccount.findUnique({ where: { userId }, select: accountSelect }),
      getEmailCounts([userId]),
      getDailyRows([userId]),
    ]);
    return { account: toStatus(account), counts: counts.get(userId) ?? emptyCounts(), team: null, daily };
  }

  const users = await prisma.user.findMany({
    where: { OR: [{ role: { name: "Recruiter" } }, { gmailAccount: { isNot: null } }, { id: userId }] },
    select: {
      id: true, firstName: true, lastName: true,
      role: { select: { name: true } },
      gmailAccount: { select: accountSelect },
    },
    orderBy: { firstName: "asc" },
  });
  const ids = users.map((u) => u.id);
  const [counts, daily] = await Promise.all([getEmailCounts(ids), getDailyRows(ids)]);

  const team = users
    .map((u) => ({
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      roleName: u.role?.name ?? null,
      account: toStatus(u.gmailAccount),
      counts: counts.get(u.id) ?? emptyCounts(),
    }))
    // Connected first, then busiest this month
    .sort((a, b) =>
      Number(!!b.account) - Number(!!a.account) ||
      (b.counts.received.month + b.counts.sent.month) - (a.counts.received.month + a.counts.sent.month) ||
      a.name.localeCompare(b.name),
    );

  const me = team.find((t) => t.userId === userId);
  return { account: me?.account ?? null, counts: me?.counts ?? emptyCounts(), team, daily };
}
